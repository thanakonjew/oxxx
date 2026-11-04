import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { apiRoute } from '@/lib/server/http'
import { listBalances, settleOpenOrders } from '@/lib/server/trading'

/** GET /api/account — the user's paper balances, after settling any resting orders the market has reached. */
export const GET = apiRoute(async (req) => {
  const user = await requireUser(req)
  await settleOpenOrders(user.id)
  const balances = await listBalances(user.id)
  return NextResponse.json({ balances }, { headers: { 'Cache-Control': 'no-store' } })
})
