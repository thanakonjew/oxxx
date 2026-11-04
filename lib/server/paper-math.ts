// Pure fixed-point math for the paper-trading engine.
// This file has no imports so it can be unit-tested with plain Node (see tests/paper-math.test.ts).
// Amounts are bigints scaled by 10^18, matching the numeric(38, 18) columns in the database.

export const SCALE_DP = 18
const SCALE = 10n ** BigInt(SCALE_DP)

const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/
const UNSIGNED_INPUT_RE = /^(\d+)(?:\.(\d+))?$/

/** Parses a decimal string such as "0.5" or "-12.25" into a scaled bigint. Throws on bad input. */
export function parseDecimal(value: string): bigint {
  const m = DECIMAL_RE.exec(value.trim())
  if (!m) throw new RangeError(`Invalid decimal: ${value}`)
  const [, sign, int, frac = ''] = m
  if (frac.length > SCALE_DP) throw new RangeError(`Too many decimal places: ${value}`)
  const scaled = BigInt(int) * SCALE + BigInt(frac.padEnd(SCALE_DP, '0'))
  return sign ? -scaled : scaled
}

/** Formats a scaled bigint as a plain decimal string without trailing zeros. */
export function formatDecimal(value: bigint): string {
  const negative = value < 0n
  const abs = negative ? -value : value
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(SCALE_DP, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

/**
 * Validates a user-supplied amount: a string of digits with at most `maxDp` decimals and greater than zero.
 * Returns the scaled value, or null when the input is not acceptable.
 */
export function parsePositiveAmount(input: unknown, maxDp: number): bigint | null {
  if (typeof input !== 'string') return null
  const m = UNSIGNED_INPUT_RE.exec(input.trim())
  if (!m) return null
  const frac = m[2] ?? ''
  if (frac.length > maxDp || frac.length > SCALE_DP) return null
  const value = parseDecimal(input)
  return value > 0n ? value : null
}

/** Multiplies two scaled values. `up` rounds a non-negative remainder up (used for fees). */
export function mul(a: bigint, b: bigint, rounding: 'down' | 'up' = 'down'): bigint {
  const product = a * b
  const quotient = product / SCALE
  if (rounding === 'up' && product > 0n && product % SCALE !== 0n) return quotient + 1n
  return quotient
}

export type Side = 'buy' | 'sell'
export type OrderType = 'limit' | 'market'
export type Liquidity = 'maker' | 'taker'

export type Fill = {
  price: bigint
  quantity: bigint
  notional: bigint
  fee: bigint
  liquidity: Liquidity
}

/** Builds a fill; the fee is charged on the notional value and rounded up. */
export function buildFill(price: bigint, quantity: bigint, feeRate: bigint, liquidity: Liquidity): Fill {
  const notional = mul(price, quantity)
  return { price, quantity, notional, fee: mul(notional, feeRate, 'up'), liquidity }
}

/** Balance changes a fill causes. Fees are always charged in the quote asset. */
export function fillDeltas(side: Side, fill: Fill): { base: bigint; quote: bigint } {
  return side === 'buy'
    ? { base: fill.quantity, quote: -(fill.notional + fill.fee) }
    : { base: -fill.quantity, quote: fill.notional - fill.fee }
}

/**
 * Price at which a new order fills immediately against the current best bid/ask, or null if it rests.
 * Market orders always take; a limit order takes when it crosses the spread (and gets the better price).
 */
export function immediateFillPrice(
  side: Side,
  type: OrderType,
  limitPrice: bigint | null,
  bid: bigint,
  ask: bigint,
): bigint | null {
  if (type === 'market') return side === 'buy' ? ask : bid
  if (limitPrice === null) throw new RangeError('Limit order needs a price')
  if (side === 'buy') return ask <= limitPrice ? ask : null
  return bid >= limitPrice ? bid : null
}

/** Whether the current best bid/ask has reached a resting limit order. Resting orders fill at their own price. */
export function restingOrderReached(side: Side, limitPrice: bigint, bid: bigint, ask: bigint): boolean {
  return side === 'buy' ? ask <= limitPrice : bid >= limitPrice
}

/** Funds frozen while a limit order rests: the quote cost plus the maker fee for buys, the base quantity for sells. */
export function restingLock(
  side: Side,
  limitPrice: bigint,
  quantity: bigint,
  makerFeeRate: bigint,
): { asset: 'base' | 'quote'; amount: bigint } {
  if (side === 'sell') return { asset: 'base', amount: quantity }
  const fill = buildFill(limitPrice, quantity, makerFeeRate, 'maker')
  return { asset: 'quote', amount: fill.notional + fill.fee }
}
