import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import {
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  createSession,
  getDummyHash,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} from '@/lib/server/auth'
import { getDb } from '@/lib/server/db'
import { users } from '@/lib/server/db/schema'
import { errors } from '@/lib/server/errors'
import { apiRoute, readJson } from '@/lib/server/http'

export const POST = apiRoute(async (req) => {
  const body = await readJson(req)
  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password || password.length > 256) throw errors.invalidCredentials()

  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    await verifyPassword(password, await getDummyHash())
    throw errors.invalidCredentials()
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw errors.accountLocked()

  if (!(await verifyPassword(password, user.passwordHash))) {
    const [counted] = await db
      .update(users)
      .set({ failedLogins: sql`${users.failedLogins} + 1` })
      .where(eq(users.id, user.id))
      .returning({ failedLogins: users.failedLogins })
    if ((counted?.failedLogins ?? 0) >= MAX_FAILED_LOGINS) {
      await db
        .update(users)
        .set({ failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) })
        .where(eq(users.id, user.id))
      throw errors.accountLocked()
    }
    throw errors.invalidCredentials()
  }

  const session = await db.transaction(async (tx) => {
    await tx.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id))
    return createSession(tx, user.id)
  })
  const res = NextResponse.json({ user: { id: user.id, email: user.email } })
  setSessionCookie(res, session)
  return res
})
