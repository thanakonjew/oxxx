import { type NextRequest, NextResponse } from 'next/server'
import { ApiError, errors } from './errors'

export function errorResponse(err: ApiError) {
  return NextResponse.json({ error: { code: err.code, zh: err.zh, en: err.en } }, { status: err.status })
}

/**
 * Wraps a route handler: rejects cross-site state-changing requests and turns thrown errors into JSON.
 * Unexpected errors are logged and returned as a generic message.
 */
// Ctx defaults to `any` so static routes satisfy Next's generated route-context type check; dynamic routes pass
// their own `{ params: Promise<...> }` type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiRoute<Ctx = any>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') assertSameOrigin(req)
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err)
      console.error('[api]', req.method, req.nextUrl.pathname, err)
      return errorResponse(errors.internal())
    }
  }
}

/** Session cookies are SameSite=Lax; this Origin check closes the remaining cross-site request paths. */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) throw errors.forbidden()
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw errors.forbidden()
  }
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim()
  if (!host || originHost !== host) throw errors.forbidden()
}

/** Reads a JSON object body; anything else is a 400. */
export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get('content-type')?.includes('application/json')) throw errors.badRequest()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw errors.badRequest()
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw errors.badRequest()
  return body as Record<string, unknown>
}
