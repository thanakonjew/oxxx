'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import type { BookLevel, MarketSnapshot } from '@/hooks/use-okx-market'
import { useI18n } from '@/lib/i18n'
import { type Market, formatNumber } from '@/lib/markets'
import { cn } from '@/lib/utils'

const ROWS = 10
type View = 'both' | 'bids' | 'asks'

function withTotals(levels: BookLevel[]) {
  let total = 0
  return levels.map((level) => {
    total += level.qty
    return { ...level, total }
  })
}

function BookRows({ rows, side, maxTotal, market }: { rows: (BookLevel & { total: number })[]; side: 'bid' | 'ask'; maxTotal: number; market: Market }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.price} className="relative grid grid-cols-3 px-3 py-[3px] text-[12px] tabular-nums">
          <span
            aria-hidden="true"
            className={cn('absolute inset-y-0 right-0 transition-[width] duration-300', side === 'bid' ? 'bg-up/15' : 'bg-down/15')}
            style={{ width: `${maxTotal ? (row.total / maxTotal) * 100 : 0}%` }}
          />
          <span className={cn('relative', side === 'bid' ? 'text-up' : 'text-down')}>{formatNumber(row.price, market.priceDp)}</span>
          <span className="relative text-right text-white/80">{formatNumber(row.qty, market.qtyDp)}</span>
          <span className="relative text-right text-white/60">{formatNumber(row.total, market.qtyDp)}</span>
        </li>
      ))}
    </ul>
  )
}

function ViewIcon({ view }: { view: View }) {
  return (
    <span aria-hidden="true" className="grid size-3.5 grid-rows-2 gap-px">
      <span className={cn('rounded-[1px]', view === 'bids' ? 'bg-white/20' : 'bg-down')} />
      <span className={cn('rounded-[1px]', view === 'asks' ? 'bg-white/20' : 'bg-up')} />
    </span>
  )
}

export function OrderBook({ market, snapshot }: { market: Market; snapshot: MarketSnapshot }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'book' | 'trades'>('book')
  const [view, setView] = useState<View>('both')

  const rowCount = view === 'both' ? ROWS : ROWS * 2
  const asks = withTotals(snapshot.asks.slice(0, rowCount))
  const bids = withTotals(snapshot.bids.slice(0, rowCount))
  const maxTotal = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0)

  const bidQty = snapshot.bids.reduce((s, l) => s + l.qty, 0)
  const askQty = snapshot.asks.reduce((s, l) => s + l.qty, 0)
  const bidPct = bidQty + askQty ? (bidQty / (bidQty + askQty)) * 100 : 50

  const price = snapshot.lastPrice ?? snapshot.tickers[market.symbol]?.last ?? null
  const up = snapshot.direction !== 'down'

  return (
    <section aria-label={t('订单簿', 'Order book')} className="flex h-full min-h-0 flex-col rounded-lg bg-panel">
      <div role="tablist" className="flex gap-5 border-b border-line px-3">
        {(
          [
            ['book', t('订单簿', 'Order Book')],
            ['trades', t('最新成交', 'Trades')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'relative py-3 text-sm transition-colors',
              tab === key ? 'text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold' : 'text-white/50 hover:text-white/80',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'book' ? (
        <>
          <div className="flex items-center gap-3 px-3 py-2">
            {(['both', 'bids', 'asks'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === 'both' ? t('买卖盘', 'Both sides') : v === 'bids' ? t('只看买盘', 'Bids only') : t('只看卖盘', 'Asks only')}
                onClick={() => setView(v)}
                className={cn('rounded p-1 transition-opacity', view === v ? 'opacity-100' : 'opacity-40 hover:opacity-70')}
              >
                <ViewIcon view={v} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 px-3 pb-1 text-[11px] text-white/40">
            <span>
              {t('价格', 'Price')} ({market.quote})
            </span>
            <span className="text-right">
              {t('数量', 'Qty')} ({market.base})
            </span>
            <span className="text-right">
              {t('合计', 'Total')} ({market.base})
            </span>
          </div>

          {/* Each side gets its own clipped half: asks hug the mid price from above and bids from below, so when the
              panel is shorter than the full ladder the far-away levels are cut off instead of spilling out of it. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {view !== 'bids' && (
              <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
                <BookRows rows={[...asks].reverse()} side="ask" maxTotal={maxTotal} market={market} />
              </div>
            )}
            <div className="flex shrink-0 items-center gap-2 px-3 py-2">
              <span className={cn('text-lg font-bold tabular-nums transition-colors', up ? 'text-up' : 'text-down')}>{formatNumber(price, market.priceDp)}</span>
              {snapshot.direction &&
                (up ? <ArrowUp className="size-4 text-up" aria-hidden="true" /> : <ArrowDown className="size-4 text-down" aria-hidden="true" />)}
              {snapshot.mark && (
                <span className="ml-auto text-[11px] tabular-nums text-white/40">
                  {t('标记', 'Mark')} {formatNumber(snapshot.mark.markPrice, market.priceDp)}
                </span>
              )}
            </div>
            {view !== 'asks' && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <BookRows rows={bids} side="bid" maxTotal={maxTotal} market={market} />
              </div>
            )}
            {!snapshot.bids.length && <p className="px-3 py-6 text-center text-xs text-white/40">{t('连接订单簿…', 'Connecting order book…')}</p>}
          </div>

          <div className="mt-auto flex shrink-0 items-center gap-2 px-3 py-3 text-[11px] tabular-nums">
            <span className="text-up">B {formatNumber(bidPct, 2)}%</span>
            <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-down">
              <div className="h-full bg-up transition-[width] duration-500" style={{ width: `${bidPct}%` }} />
            </div>
            <span className="text-down">{formatNumber(100 - bidPct, 2)}% S</span>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-3 px-3 py-2 text-[11px] text-white/40">
            <span>
              {t('价格', 'Price')} ({market.quote})
            </span>
            <span className="text-right">
              {t('数量', 'Qty')} ({market.base})
            </span>
            <span className="text-right">{t('时间', 'Time')}</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {snapshot.trades.map((trade) => (
              <li key={trade.id} className="grid grid-cols-3 px-3 py-[3px] text-[12px] tabular-nums">
                <span className={trade.buyerMaker ? 'text-down' : 'text-up'}>{formatNumber(trade.price, market.priceDp)}</span>
                <span className="text-right text-white/80">{formatNumber(trade.qty, market.qtyDp)}</span>
                <span className="text-right text-white/50">{new Date(trade.time).toLocaleTimeString('en-GB', { hour12: false })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
