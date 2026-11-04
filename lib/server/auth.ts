import { createHash, randomBytes, scrypt as scryptCallback, type ScryptOptions, timingSafeEqual } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { NextRequest, NextResponse } from 'next/server'
import { EMAIL_RE } from '@/lib/paper-trading'
import { getDb, type Tx } from './db'
import { sessions, users } from './db/schema'
import { errors } from './errors'

export const SESSION_COOKIE = 'oxxx_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const MAX_FAILED_LOGINS = 10
export const LOCK_DURATION_MS = 15 * 60 * 1000

// scrypt with N = 2^15, r = 8 needs 32 MiB, just above Node's default maxmem, so raise the cap.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const
const KEY_LENGTH = 64

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

/** Hashes a password as `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, SCRYPT)
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltText, keyText] = stored.split('$')
  if (scheme !== 'scrypt' || !saltText || !keyText) return false
  const expected = Buffer.from(keyText, 'base64url')
  if (expected.length !== KEY_LENGTH) return false
  const actual = await scrypt(password, Buffer.from(saltText, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  })
  return timingSafeEqual(actual, expected)
}

let dummyHash: Promise<string> | null = null
/** A hash to verify against when the email is unknown, so response time doesn't reveal which emails exist. */
export function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'))
  return dummyHash
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export type Session = { token: string; expiresAt: Date }

export async function createSession(tx: Tx, userId: string): Promise<Session> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await tx.insert(sessions).values({ id: hashToken(token), userId, expiresAt })
  return { token, expiresAt }
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function setSessionCookie(res: NextResponse, session: Session) {
  res.cookies.set(SESSION_COOKIE, session.token, { ...cookieBase, expires: session.expiresAt })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 })
}

function readToken(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  return token && token.length <= 128 ? token : null
}

export type SessionUser = { id: string; email: string }

/** The logged-in user for this request, or null. Touches the database only when a session cookie is present. */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = readToken(req)
  if (!token) return null
  const [row] = await getDb()
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return row ?? null
}

export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(req)
  if (!user) throw errors.unauthorized()
  return user
}

export async function deleteSession(req: NextRequest) {
  const token = readToken(req)
  if (token) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)))
}
