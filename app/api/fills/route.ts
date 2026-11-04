import { NextResponse } from 'next/server'
import { isMarketSymbol } from '@/lib/markets'
import { requireUser } from '@/lib/server/auth'
import { apiRoute } from '@/lib/server/http'
import { listFills } from '@/lib/server/trading'

/** GET /api/fills?symbol=BTCUSDT — the user's paper trades, newest first. */
export const GET = apiRoute(async (req) => {
  const user = await requireUser(req)
  const symbolParam = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const symbol = symbolParam && isMarketSymbol(symbolParam) ? symbolParam : undefined
  const fills = await listFills(user.id, { symbol })
  return NextResponse.json({ fills }, { headers: { 'Cache-Control': 'no-store' } })
})
