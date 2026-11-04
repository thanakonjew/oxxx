/** An error returned by our API, with the message in both languages. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly zh: string,
    readonly en: string,
  ) {
    super(en)
  }
}

/** Calls one of our JSON API routes; non-2xx responses throw ApiRequestError. */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiRequestError(0, 'network_error', '网络连接失败，请检查网络后重试', 'Network error. Check your connection and try again.')
  }
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; zh?: string; en?: string } } | null
  if (!res.ok) {
    const e = data?.error
    throw new ApiRequestError(
      res.status,
      e?.code ?? 'request_failed',
      e?.zh ?? '请求失败，请稍后重试',
      e?.en ?? 'Request failed. Please try again.',
    )
  }
  return data as T
}

export const swrFetcher = <T>(path: string) => apiFetch<T>(path)

/** The `?next=` path to return to after login, limited to same-site paths. */
export function nextPathFromLocation(fallback = '/trade/BTCUSDT'): string {
  if (typeof window === 'undefined') return fallback
  const next = new URLSearchParams(window.location.search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}

export function loginHref(returnTo: string) {
  return `/login?next=${encodeURIComponent(returnTo)}`
}
