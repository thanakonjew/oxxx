'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api-client'

export type PaperBalance = { asset: string; available: string; locked: string }

export type PaperOrder = {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'limit' | 'market'
  price: string | null
  quantity: string
  status: 'open' | 'filled' | 'canceled'
  lockedAsset: string | null
  lockedAmount: string
  filledPrice: string | null
  fee: string | null
  createdAt: string
  updatedAt: string
}

export type PaperFill = {
  id: string
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  price: string
  quantity: string
  fee: string
  feeAsset: string
  liquidity: 'maker' | 'taker'
  createdAt: string
}

// Each poll also settles resting orders on the server, so open orders fill within a few seconds of being reached.
const LIVE_MS = 5000
const HISTORY_MS = 15000

/** Paper-trading balances, orders and fills for the logged-in user. Pass `enabled = false` when signed out. */
export function usePaperAccount(enabled: boolean) {
  const balances = useSWR<{ balances: PaperBalance[] }>(enabled ? '/api/account' : null, swrFetcher, {
    refreshInterval: LIVE_MS,
  })
  const openOrders = useSWR<{ orders: PaperOrder[] }>(enabled ? '/api/orders?status=open' : null, swrFetcher, {
    refreshInterval: LIVE_MS,
  })
  const closedOrders = useSWR<{ orders: PaperOrder[] }>(enabled ? '/api/orders?status=closed' : null, swrFetcher, {
    refreshInterval: HISTORY_MS,
  })
  const fills = useSWR<{ fills: PaperFill[] }>(enabled ? '/api/fills' : null, swrFetcher, { refreshInterval: HISTORY_MS })

  const { mutate: mutateBalances } = balances
  const { mutate: mutateOpen } = openOrders
  const { mutate: mutateClosed } = closedOrders
  const { mutate: mutateFills } = fills
  const refresh = useCallback(
    () => Promise.all([mutateBalances(), mutateOpen(), mutateClosed(), mutateFills()]),
    [mutateBalances, mutateOpen, mutateClosed, mutateFills],
  )

  return {
    balances: balances.data?.balances ?? [],
    openOrders: openOrders.data?.orders ?? [],
    closedOrders: closedOrders.data?.orders ?? [],
    fills: fills.data?.fills ?? [],
    isLoading: enabled && balances.isLoading,
    refresh,
  }
}

/** Available amount of one asset, as a string (defaults to "0"). */
export function availableOf(balances: PaperBalance[], asset: string) {
  return balances.find((b) => b.asset === asset)?.available ?? '0'
}
