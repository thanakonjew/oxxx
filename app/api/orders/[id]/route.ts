import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { errors } from '@/lib/server/errors'
import { apiRoute } from '@/lib/server/http'
import { cancelOrder } from '@/lib/server/trading'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** DELETE /api/orders/:id — cancels an open paper order. */
export const DELETE = apiRoute<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser(req)
  const { id } = await params
  if (!UUID_RE.test(id)) throw errors.orderNotFound()
  const order = await cancelOrder(user.id, id)
  return NextResponse.json({ order })
})
