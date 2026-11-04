import { NextResponse } from 'next/server'
import { clearSessionCookie, deleteSession } from '@/lib/server/auth'
import { apiRoute } from '@/lib/server/http'

export const POST = apiRoute(async (req) => {
  await deleteSession(req)
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
})
