import { type SQL, and, desc, eq, inArray } from 'drizzle-orm'
import { MARKETS, type MarketSymbol, isMarketSymbol, okxInstId } from '@/lib/markets'
import { PAPER_TRADING } from '@/lib/paper-trading'
import { type Tx, getDb } from './db'
import { type BalanceRow, type FillRow, type OrderRow, balances, fills, orders } from './db/schema'
import { errors } from './errors'
import { type BestQuote, getBestQuote } from './okx'
import {
  buildFill,
  fillDeltas,
  formatDecimal,
  immediateFillPrice,
  mul,
  type OrderType,
  parseDecimal,
  parsePositiveAmount,
  restingLock,
  restingOrderReached,
  type Side,
} from './paper-math'

const MAKER_FEE = parseDecimal(PAPER_TRADING.makerFeeRate)
const TAKER_FEE = parseDecimal(PAPER_TRADING.takerFeeRate)
const MIN_NOTIONAL = parseDecimal(PAPER_TRADING.minNotional)

type Wallet = Map<string, { available: bigint; locked: bigint }>

/** Creates any missing balance rows, then locks the requested rows (in a fixed order to avoid deadlocks). */
async function lockWallet(tx: Tx, userId: string, assets: string[]): Promise<Wallet> {
  const wanted = [...new Set(assets)].sort()
  await tx
    .insert(balances)
    .values(wanted.map((asset) => ({ userId, asset })))
    .onConflictDoNothing()
  const rows = await tx
    .select()
    .from(balances)
    .where(and(eq(balances.userId, userId), inArray(balances.asset, wanted)))
    .orderBy(balances.asset)
    .for('update')
  const wallet: Wallet = new Map()
  for (const row of rows) wallet.set(row.asset, { available: parseDecimal(row.available), locked: parseDecimal(row.locked) })
  for (const asset of wanted) if (!wallet.has(asset)) throw new Error(`Balance row missing for ${asset}`)
  return wallet
}

async function saveWallet(tx: Tx, userId: string, wallet: Wallet) {
  for (const [asset, b] of wallet) {
    if (b.available < 0n || b.locked < 0n) throw new Error(`Balance would go negative for ${asset}`)
    await tx
      .update(balances)
      .set({ available: formatDecimal(b.available), locked: formatDecimal(b.locked), updatedAt: new Date() })
      .where(and(eq(balances.userId, userId), eq(balances.asset, asset)))
  }
}

function invalid(zh: string, en: string): never {
  throw errors.invalidOrder(zh, en)
}

/** Validates and places a spot paper order: market and crossing limit orders fill at once, others rest. */
export async function placeOrder(userId: string, input: Record<string, unknown>) {
  const rawSymbol = typeof input.symbol === 'string' ? input.symbol.toUpperCase() : ''
  const symbol: MarketSymbol = isMarketSymbol(rawSymbol) ? rawSymbol : invalid('交易对不存在', 'Unknown trading pair')
  const market = MARKETS[symbol]
  const side: Side = input.side === 'buy' || input.side === 'sell' ? input.side : invalid('请选择买入或卖出', 'Choose buy or sell')
  const type: OrderType =
    input.type === 'limit' || input.type === 'market' ? input.type : invalid('请选择限价或市价', 'Choose limit or market')

  const quantity: bigint =
    parsePositiveAmount(input.quantity, market.qtyDp) ??
    invalid(`数量需大于 0，最多 ${market.qtyDp} 位小数`, `Amount must be above 0 with at most ${market.qtyDp} decimals`)
  const limitPrice: bigint | null =
    type === 'market'
      ? null
      : (parsePositiveAmount(input.price, market.priceDp) ??
        invalid(`价格需大于 0，最多 ${market.priceDp} 位小数`, `Price must be above 0 with at most ${market.priceDp} decimals`))

  // Settle earlier orders first so freshly filled proceeds count as available.
  await settleOpenOrders(userId)

  const quote = await getBestQuote(okxInstId(market, 'spot'))
  const fillPrice = immediateFillPrice(side, type, limitPrice, quote.bid, quote.ask)
  const referencePrice = fillPrice ?? (limitPrice as bigint)
  if (mul(referencePrice, quantity) < MIN_NOTIONAL) {
    invalid(`单笔金额不能低于 ${PAPER_TRADING.minNotional} ${market.quote}`, `Order value must be at least ${PAPER_TRADING.minNotional} ${market.quote}`)
  }

  const row = await getDb().transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId, [market.base, market.quote])
    const base = wallet.get(market.base)!
    const quoteBalance = wallet.get(market.quote)!
    const common = {
      userId,
      symbol,
      side,
      type,
      price: limitPrice === null ? null : formatDecimal(limitPrice),
      quantity: formatDecimal(quantity),
    }

    if (fillPrice !== null) {
      const fill = buildFill(fillPrice, quantity, TAKER_FEE, 'taker')
      const delta = fillDeltas(side, fill)
      if (base.available + delta.base < 0n || quoteBalance.available + delta.quote < 0n) throw errors.insufficientBalance()
      base.available += delta.base
      quoteBalance.available += delta.quote
      await saveWallet(tx, userId, wallet)
      const [order] = await tx
        .insert(orders)
        .values({ ...common, status: 'filled', filledPrice: formatDecimal(fill.price), fee: formatDecimal(fill.fee) })
        .returning()
      await tx.insert(fills).values(fillValues(order, fill, market.quote))
      return order
    }

    const lock = restingLock(side, limitPrice as bigint, quantity, MAKER_FEE)
    const lockAsset = lock.asset === 'base' ? market.base : market.quote
    const balance = wallet.get(lockAsset)!
    if (balance.available < lock.amount) throw errors.insufficientBalance()
    balance.available -= lock.amount
    balance.locked += lock.amount
    await saveWallet(tx, userId, wallet)
    const [order] = await tx
      .insert(orders)
      .values({ ...common, status: 'open', lockedAsset: lockAsset, lockedAmount: formatDecimal(lock.amount) })
      .returning()
    return order
  })
  return serializeOrder(row)
}

function fillValues(order: OrderRow, fill: ReturnType<typeof buildFill>, feeAsset: string) {
  return {
    orderId: order.id,
    userId: order.userId,
    symbol: order.symbol,
    side: order.side,
    price: formatDecimal(fill.price),
    quantity: formatDecimal(fill.quantity),
    fee: formatDecimal(fill.fee),
    feeAsset,
    liquidity: fill.liquidity,
  }
}

/** Cancels an open order and returns its frozen funds. */
export async function cancelOrder(userId: string, orderId: string) {
  const row = await getDb().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .for('update')
    if (!order) throw errors.orderNotFound()
    if (order.status !== 'open') throw errors.orderNotOpen()

    const locked = parseDecimal(order.lockedAmount)
    if (order.lockedAsset && locked > 0n) {
      const wallet = await lockWallet(tx, userId, [order.lockedAsset])
      const balance = wallet.get(order.lockedAsset)!
      balance.locked -= locked
      balance.available += locked
      await saveWallet(tx, userId, wallet)
    }
    const [updated] = await tx
      .update(orders)
      .set({ status: 'canceled', lockedAmount: '0', updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning()
    return updated
  })
  return serializeOrder(row)
}

/**
 * Fills the user's resting limit orders that the current best bid/ask has reached, at their limit price as maker.
 * Runs whenever the user reads or changes their account, so fills appear while the trading page polls.
 * An order whose price is touched and left again between two checks is not filled.
 */
export async function settleOpenOrders(userId: string): Promise<number> {
  const open = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'open')))
  if (open.length === 0) return 0

  const symbols = [...new Set(open.map((o) => o.symbol))].filter(isMarketSymbol)
  const quotes = new Map<string, BestQuote>()
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        quotes.set(symbol, await getBestQuote(okxInstId(MARKETS[symbol], 'spot')))
      } catch {
        // No price for this market right now; its orders stay open until a later check.
      }
    }),
  )

  let filled = 0
  for (const order of open) {
    const quote = quotes.get(order.symbol)
    if (!quote || order.price === null) continue
    if (!restingOrderReached(order.side, parseDecimal(order.price), quote.bid, quote.ask)) continue
    if (await fillRestingOrder(userId, order.id)) filled++
  }
  return filled
}

async function fillRestingOrder(userId: string, orderId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .for('update')
    // Re-check under the row lock: another request may have filled or canceled it meanwhile.
    if (!order || order.status !== 'open' || order.price === null || !isMarketSymbol(order.symbol)) return false
    const market = MARKETS[order.symbol]
    if (order.lockedAsset !== market.base && order.lockedAsset !== market.quote) {
      throw new Error(`Order ${order.id} has unexpected locked asset ${order.lockedAsset}`)
    }

    const fill = buildFill(parseDecimal(order.price), parseDecimal(order.quantity), MAKER_FEE, 'maker')
    const delta = fillDeltas(order.side, fill)
    const locked = parseDecimal(order.lockedAmount)
    const wallet = await lockWallet(tx, userId, [market.base, market.quote])
    const base = wallet.get(market.base)!
    const quoteBalance = wallet.get(market.quote)!
    const lockedBalance = order.lockedAsset === market.base ? base : quoteBalance
    // Release the frozen funds, then apply the fill (the lock covers the fill exactly; see restingLock).
    lockedBalance.locked -= locked
    lockedBalance.available += locked
    base.available += delta.base
    quoteBalance.available += delta.quote
    await saveWallet(tx, userId, wallet)

    const [updated] = await tx
      .update(orders)
      .set({
        status: 'filled',
        filledPrice: formatDecimal(fill.price),
        fee: formatDecimal(fill.fee),
        lockedAmount: '0',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))
      .returning()
    await tx.insert(fills).values(fillValues(updated, fill, market.quote))
    return true
  })
}

export async function listOrders(
  userId: string,
  options: { status: 'open' | 'closed'; symbol?: MarketSymbol; limit?: number },
) {
  const conditions: SQL[] = [
    eq(orders.userId, userId),
    options.status === 'open' ? eq(orders.status, 'open') : inArray(orders.status, ['filled', 'canceled']),
  ]
  if (options.symbol) conditions.push(eq(orders.symbol, options.symbol))
  const rows = await getDb()
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(options.limit ?? 50)
  return rows.map(serializeOrder)
}

export async function listFills(userId: string, options: { symbol?: MarketSymbol; limit?: number } = {}) {
  const conditions: SQL[] = [eq(fills.userId, userId)]
  if (options.symbol) conditions.push(eq(fills.symbol, options.symbol))
  const rows = await getDb()
    .select()
    .from(fills)
    .where(and(...conditions))
    .orderBy(desc(fills.createdAt))
    .limit(options.limit ?? 50)
  return rows.map(serializeFill)
}

export async function listBalances(userId: string) {
  const rows = await getDb().select().from(balances).where(eq(balances.userId, userId)).orderBy(balances.asset)
  return rows.map(serializeBalance).filter((b) => b.available !== '0' || b.locked !== '0')
}

const clean = (value: string) => formatDecimal(parseDecimal(value))
const cleanOrNull = (value: string | null) => (value === null ? null : clean(value))

function serializeOrder(row: OrderRow) {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    type: row.type,
    price: cleanOrNull(row.price),
    quantity: clean(row.quantity),
    status: row.status,
    lockedAsset: row.lockedAsset,
    lockedAmount: clean(row.lockedAmount),
    filledPrice: cleanOrNull(row.filledPrice),
    fee: cleanOrNull(row.fee),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeFill(row: FillRow) {
  return {
    id: row.id,
    orderId: row.orderId,
    symbol: row.symbol,
    side: row.side,
    price: clean(row.price),
    quantity: clean(row.quantity),
    fee: clean(row.fee),
    feeAsset: row.feeAsset,
    liquidity: row.liquidity,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeBalance(row: BalanceRow) {
  return { asset: row.asset, available: clean(row.available), locked: clean(row.locked) }
}
