import { NextResponse } from 'next/server'
import { PAPER_TRADING, passwordIssue } from '@/lib/paper-trading'
import { createSession, hashPassword, normalizeEmail, setSessionCookie } from '@/lib/server/auth'
import { getDb } from '@/lib/server/db'
import { balances, users } from '@/lib/server/db/schema'
import { errors, isUniqueViolation } from '@/lib/server/errors'
import { apiRoute, readJson } from '@/lib/server/http'

export const POST = apiRoute(async (req) => {
  const body = await readJson(req)
  const email = normalizeEmail(body.email)
  if (!email) throw errors.invalidEmail()
  const password = typeof body.password === 'string' ? body.password : ''
  if (passwordIssue(password)) throw errors.weakPassword()

  const passwordHash = await hashPassword(password)
  try {
    const { user, session } = await getDb().transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email })
      // Every new account starts with virtual funds for paper trading.
      const grants = Object.entries(PAPER_TRADING.initialBalances).map(([asset, available]) => ({
        userId: user.id,
        asset,
        available,
      }))
      if (grants.length > 0) await tx.insert(balances).values(grants)
      const session = await createSession(tx, user.id)
      return { user, session }
    })
    const res = NextResponse.json({ user }, { status: 201 })
    setSessionCookie(res, session)
    return res
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.emailTaken()
    throw err
  }
})
