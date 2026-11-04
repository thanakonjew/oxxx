import { errors } from './errors'
import { parseDecimal } from './paper-math'

const TICKER_URL = 'https://www.okx.com/api/v5/market/ticker'
// OKX limits the public ticker endpoint per IP, and every user shares the server's IP, so reuse quotes briefly.
const CACHE_MS = 1000

export type BestQuote = { bid: bigint; ask: bigint }

const cache = new Map<string, { at: number; quote: Promise<BestQuote> }>()

/** Best bid and ask for an OKX instrument such as "BTC-USDT", fetched on the server so clients can't supply prices. */
export function getBestQuote(instId: string): Promise<BestQuote> {
  const hit = cache.get(instId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.quote
  const entry = { at: Date.now(), quote: fetchQuote(instId) }
  cache.set(instId, entry)
  entry.quote.catch(() => {
    if (cache.get(instId) === entry) cache.delete(instId)
  })
  return entry.quote
}

function positive(value: unknown): bigint | null {
  if (typeof value !== 'string' || value === '') return null
  try {
    const parsed = parseDecimal(value)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

async function fetchQuote(instId: string): Promise<BestQuote> {
  let body: { code?: string; data?: { bidPx?: string; askPx?: string }[] } | null = null
  try {
    const res = await fetch(`${TICKER_URL}?instId=${encodeURIComponent(instId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) body = await res.json()
  } catch {
    body = null
  }
  const row = body?.code === '0' ? body.data?.[0] : undefined
  const bid = positive(row?.bidPx)
  const ask = positive(row?.askPx)
  if (bid === null || ask === null || bid > ask) throw errors.priceUnavailable()
  return { bid, ask }
}
