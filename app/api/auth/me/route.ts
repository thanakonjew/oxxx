import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/server/auth'
import { apiRoute } from '@/lib/server/http'

/** Returns the logged-in user, or `{ user: null }` when signed out. */
export const GET = apiRoute(async (req) => {
  const user = await getSessionUser(req)
  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } })
})
