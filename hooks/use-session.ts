'use client'

import { useCallback } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { apiFetch, swrFetcher } from '@/lib/api-client'

export type SessionUser = { id: string; email: string }

const SESSION_KEY = '/api/auth/me'

/** The logged-in user (null when signed out or while loading), plus logout. */
export function useSession() {
  const { mutate: globalMutate } = useSWRConfig()
  const { data, isLoading, mutate } = useSWR<{ user: SessionUser | null }>(SESSION_KEY, swrFetcher, {
    shouldRetryOnError: false,
  })

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST', body: {} })
    await mutate({ user: null }, { revalidate: false })
    // Drop cached account data so it never shows for the next user.
    await globalMutate((key) => typeof key === 'string' && key !== SESSION_KEY && key.startsWith('/api/'), undefined, {
      revalidate: false,
    })
  }, [mutate, globalMutate])

  return { user: data?.user ?? null, isLoading, refresh: mutate, logout }
}
