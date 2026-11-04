import { NextResponse } from 'next/server'
import { isMarketSymbol } from '@/lib/markets'
import { requireUser } from '@/lib/server/auth'
import { apiRoute, readJson } from '@/lib/server/http'
import { listOrders, placeOrder, settleOpenOrders } from '@/lib/server/trading'

/** GET /api/orders?status=open|closed&symbol=BTCUSDT — the user's paper orders, newest first. */
export const GET = apiRoute(async (req) => {
  const user = await requireUser(req)
  const params = req.nextUrl.searchParams
  const status = params.get('status') === 'closed' ? 'closed' : 'open'
  const symbolParam = params.get('symbol')?.toUpperCase()
  const symbol = symbolParam && isMarketSymbol(symbolParam) ? symbolParam : undefined
  await settleOpenOrders(user.id)
  const orders = await listOrders(user.id, { status, symbol })
  return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'no-store' } })
})

/** POST /api/orders { symbol, side, type, quantity, price? } — places a spot paper order. */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req)
  const order = await placeOrder(user.id, await readJson(req))
  return NextResponse.json({ order }, { status: 201 })
})
