'use client'

import { Inbox } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type PaperBalance, type PaperFill, type PaperOrder, usePaperAccount } from '@/hooks/use-paper-account'
import { useSession } from '@/hooks/use-session'
import { ApiRequestError, apiFetch, loginHref } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { MARKETS, isMarketSymbol } from '@/lib/markets'
import { cn } from '@/lib/utils'

type TabKey = 'positions' | 'open' | 'history' | 'fills' | 'ledger' | 'assets'

/** Formats a decimal string from the API for display, or "--" when absent. */
function fmt(value: string | null | undefined, maxDp = 8) {
  if (value === null || value === undefined) return '--'
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: maxDp }) : value
}

function pairOf(symbol: string) {
  return isMarketSymbol(symbol) ? `${MARKETS[symbol].base}/${MARKETS[symbol].quote}` : symbol
}

function dpOf(symbol: string) {
  return isMarketSymbol(symbol) ? MARKETS[symbol] : { priceDp: 8, qtyDp: 8 }
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-sm text-white/40">
      <Inbox className="size-8 text-white/20" strokeWidth={1.4} aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="text-white/40">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums text-white/85">
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-line/60">
              {cells.map((cell, j) => (
                <td key={j} className="whitespace-nowrap px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SideText({ side }: { side: 'buy' | 'sell' }) {
  const { t } = useI18n()
  return <span className={side === 'buy' ? 'text-up' : 'text-down'}>{side === 'buy' ? t('买入', 'Buy') : t('卖出', 'Sell')}</span>
}

function useTimeFormat() {
  const { lang } = useI18n()
  return (iso: string) =>
    new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
}

function OpenOrdersTable({ orders, onChanged }: { orders: PaperOrder[]; onChanged: () => Promise<unknown> }) {
  const { t } = useI18n()
  const time = useTimeFormat()
  const [canceling, setCanceling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancel = async (id: string) => {
    setCanceling(id)
    setError(null)
    try {
      await apiFetch(`/api/orders/${id}`, { method: 'DELETE' })
      await onChanged()
    } catch (err) {
      setError(err instanceof ApiRequestError ? t(err.zh, err.en) : t('撤单失败，请稍后重试', 'Cancel failed. Please try again.'))
    } finally {
      setCanceling(null)
    }
  }

  if (orders.length === 0) return <EmptyState>{t('暂无当前委托', 'No open orders')}</EmptyState>
  return (
    <>
      {error && (
        <p role="alert" className="px-4 pt-2 text-xs text-down">
          {error}
        </p>
      )}
      <DataTable
        head={[t('时间', 'Time'), t('交易对', 'Pair'), t('方向', 'Side'), t('委托价', 'Price'), t('数量', 'Amount'), t('冻结', 'Frozen'), '']}
        rows={orders.map((o) => {
          const dp = dpOf(o.symbol)
          return [
            time(o.createdAt),
            pairOf(o.symbol),
            <SideText key="side" side={o.side} />,
            fmt(o.price, dp.priceDp),
            fmt(o.quantity, dp.qtyDp),
            `${fmt(o.lockedAmount)} ${o.lockedAsset ?? ''}`,
            <button
              key="cancel"
              type="button"
              disabled={canceling === o.id}
              onClick={() => void cancel(o.id)}
              className="text-gold transition-colors hover:text-gold-light disabled:opacity-50"
            >
              {canceling === o.id ? t('撤单中…', 'Canceling…') : t('撤单', 'Cancel')}
            </button>,
          ]
        })}
      />
    </>
  )
}

function OrderHistoryTable({ orders }: { orders: PaperOrder[] }) {
  const { t } = useI18n()
  const time = useTimeFormat()
  if (orders.length === 0) return <EmptyState>{t('暂无历史委托', 'No order history')}</EmptyState>
  return (
    <DataTable
      head={[t('时间', 'Time'), t('交易对', 'Pair'), t('方向', 'Side'), t('类型', 'Type'), t('委托价', 'Price'), t('成交均价', 'Avg. price'), t('数量', 'Amount'), t('状态', 'Status')]}
      rows={orders.map((o) => {
        const dp = dpOf(o.symbol)
        return [
          time(o.createdAt),
          pairOf(o.symbol),
          <SideText key="side" side={o.side} />,
          o.type === 'limit' ? t('限价', 'Limit') : t('市价', 'Market'),
          o.type === 'market' ? t('市价', 'Market') : fmt(o.price, dp.priceDp),
          fmt(o.filledPrice, dp.priceDp),
          fmt(o.quantity, dp.qtyDp),
          o.status === 'filled' ? t('已成交', 'Filled') : t('已撤销', 'Canceled'),
        ]
      })}
    />
  )
}

function FillsTable({ fills }: { fills: PaperFill[] }) {
  const { t } = useI18n()
  const time = useTimeFormat()
  if (fills.length === 0) return <EmptyState>{t('暂无成交记录', 'No trades yet')}</EmptyState>
  return (
    <DataTable
      head={[t('时间', 'Time'), t('交易对', 'Pair'), t('方向', 'Side'), t('成交价', 'Price'), t('数量', 'Amount'), t('手续费', 'Fee'), t('角色', 'Role')]}
      rows={fills.map((f) => {
        const dp = dpOf(f.symbol)
        return [
          time(f.createdAt),
          pairOf(f.symbol),
          <SideText key="side" side={f.side} />,
          fmt(f.price, dp.priceDp),
          fmt(f.quantity, dp.qtyDp),
          `${fmt(f.fee)} ${f.feeAsset}`,
          f.liquidity === 'maker' ? 'Maker' : 'Taker',
        ]
      })}
    />
  )
}

function AssetsTable({ balances }: { balances: PaperBalance[] }) {
  const { t } = useI18n()
  if (balances.length === 0) return <EmptyState>{t('暂无资产', 'No assets')}</EmptyState>
  return (
    <DataTable
      head={[t('币种', 'Asset'), t('可用', 'Available'), t('冻结', 'Frozen')]}
      rows={balances.map((b) => [b.asset, fmt(b.available), fmt(b.locked)])}
    />
  )
}

export function PositionsPanel() {
  const { t } = useI18n()
  const pathname = usePathname()
  const { user } = useSession()
  const account = usePaperAccount(Boolean(user))
  const [tab, setTab] = useState<TabKey>('positions')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'positions', label: t('当前持仓 (0)', 'Positions (0)') },
    { key: 'open', label: t(`当前委托 (${account.openOrders.length})`, `Open Orders (${account.openOrders.length})`) },
    { key: 'history', label: t('历史委托', 'Order History') },
    { key: 'fills', label: t('历史成交', 'Trade History') },
    { key: 'ledger', label: t('资金流水', 'Transactions') },
    { key: 'assets', label: t('资产', 'Assets') },
  ]

  let content: React.ReactNode
  if (!user) {
    content = (
      <EmptyState>
        {t('暂无数据，', 'No data yet. ')}
        <Link href={loginHref(pathname ?? '/trade/BTCUSDT')} className="text-gold hover:text-gold-light">
          {t('登录', 'Log in')}
        </Link>
        {t(' 后查看', ' to view')}
      </EmptyState>
    )
  } else if (tab === 'positions') {
    content = <EmptyState>{t('模拟交易为现货，持有的币种请查看「资产」', 'Paper trading is spot only. See Assets for your holdings.')}</EmptyState>
  } else if (tab === 'open') {
    content = <OpenOrdersTable orders={account.openOrders} onChanged={account.refresh} />
  } else if (tab === 'history') {
    content = <OrderHistoryTable orders={account.closedOrders} />
  } else if (tab === 'fills') {
    content = <FillsTable fills={account.fills} />
  } else if (tab === 'assets') {
    content = <AssetsTable balances={account.balances} />
  } else {
    content = <EmptyState>{t('资金流水暂未开放', 'Transactions are not available yet')}</EmptyState>
  }

  return (
    <section aria-label={t('订单与持仓', 'Orders and positions')} className="flex min-h-64 flex-col rounded-lg bg-panel">
      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-line px-4 [scrollbar-width:none]">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              'relative shrink-0 py-3 text-sm transition-colors',
              tab === item.key ? 'font-bold text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold' : 'text-white/50 hover:text-white/80',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-1 flex-col">
        {content}
      </div>
    </section>
  )
}

/** Account card for a logged-in user: virtual balances only. */
function PaperAccountPanel() {
  const { t } = useI18n()
  const account = usePaperAccount(true)
  return (
    <section aria-label={t('模拟账户', 'Paper account')} className="flex min-h-64 flex-col gap-4 rounded-lg bg-panel p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
        {t('模拟账户', 'Paper Account')}
        <span className="rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[11px] font-bold text-gold-light">
          {t('虚拟资金', 'Virtual funds')}
        </span>
      </h2>
      {account.isLoading ? (
        <p className="text-sm text-white/40">{t('加载中…', 'Loading…')}</p>
      ) : account.balances.length === 0 ? (
        <p className="text-sm text-white/40">{t('暂无资产', 'No assets')}</p>
      ) : (
        <dl className="flex flex-col gap-3 text-sm">
          {account.balances.slice(0, 6).map((b) => (
            <div key={b.asset} className="flex items-center justify-between gap-4">
              <dt className="text-white/60">{b.asset}</dt>
              <dd className="text-right font-mono tabular-nums text-white/90">
                {fmt(b.available)}
                {b.locked !== '0' && (
                  <span className="block text-[11px] text-white/40">
                    {t('冻结', 'Frozen')} {fmt(b.locked)}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-auto text-xs leading-relaxed text-white/40">
        {t('模拟资金仅用于模拟交易，不支持充值、提现或划转。', 'Virtual funds are for paper trading only: no deposits, withdrawals or transfers.')}
      </p>
    </section>
  )
}

type AccountRow = {
  label: string
  value: string
  lines: string[]
  breakdown?: { label: string; value: string }[]
}

export function AccountPanel() {
  const { t } = useI18n()
  const { user } = useSession()
  if (user) return <PaperAccountPanel />
  const rows: AccountRow[] = [
    {
      label: t('维持保证金率', 'Maint. margin rate'),
      value: '0.00%',
      lines: [
        t('风险衡量指标。', 'Risk indicator.'),
        t('维持保证金率(MMR) = 维持保证金 / 有效保证金', 'MMR = Maintenance margin / Effective margin'),
        t('维持保证金(MM) = 合约维持保证金 + 借币维持保证金', 'MM = Contract MM + Borrowing MM'),
      ],
      breakdown: [
        { label: t('维持保证金', 'Maintenance margin'), value: '--' },
        { label: t('合约维持保证金', 'Contract MM'), value: '--' },
        { label: t('借币维持保证金', 'Borrowing MM'), value: '--' },
      ],
    },
    {
      label: t('初始保证金率', 'Initial margin rate'),
      value: '0.00%',
      lines: [
        t('资金占用率。', 'Capital utilization.'),
        t('初始保证金率(IMR) = 初始保证金 / 有效保证金', 'IMR = Initial margin / Effective margin'),
        t('初始保证金(IM) = 合约初始保证金 + 借币初始保证金', 'IM = Contract IM + Borrowing IM'),
      ],
      breakdown: [
        { label: t('初始保证金', 'Initial margin'), value: '--' },
        { label: t('合约初始保证金', 'Contract IM'), value: '--' },
        { label: t('借币初始保证金', 'Borrowing IM'), value: '--' },
      ],
    },
    {
      label: t('有效保证金', 'Effective margin'),
      value: '--',
      lines: [
        t(
          '加密货币、现金宝和定期理财考虑折扣率之后可做交易保证金的数量',
          'Amount of crypto, savings and fixed-term products usable as trading margin after haircuts',
        ),
      ],
    },
    {
      label: t('账户杠杆', 'Account leverage'),
      value: '--',
      lines: [
        t('账户层面整体杠杆。', 'Overall account-level leverage.'),
        t('账户杠杆 = 总仓位价值 / 有效保证金', 'Account leverage = Total position value / Effective margin'),
        t('总仓位价值 = 合约价值 + 借币价值', 'Total position value = Contract value + Borrowed value'),
      ],
      breakdown: [
        { label: t('总仓位价值', 'Total position value'), value: '--' },
        { label: t('合约价值', 'Contract value'), value: '--' },
        { label: t('借币价值', 'Borrowed value'), value: '--' },
      ],
    },
  ]
  return (
    <section aria-label={t('统一账户', 'Unified account')} className="flex min-h-64 flex-col gap-5 rounded-lg bg-panel p-4">
      <h2 className="text-[15px] font-bold text-white">{t('统一账户', 'Unified Account')}</h2>
      <p className="flex items-center gap-2 text-sm text-white/85">
        <span>{t('保证金模式', 'Margin mode')}</span>
        <span aria-hidden="true" className="text-white/40">
          ·
        </span>
        <span>{t('全仓', 'Cross')}</span>
      </p>
      <TooltipProvider delay={100}>
        <dl className="flex flex-col gap-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <dt>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="cursor-help text-left text-white/50 underline decoration-white/25 decoration-dashed underline-offset-4 transition-colors hover:text-white/80"
                  >
                    {row.label}
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="flex max-w-sm flex-col items-stretch gap-3 bg-raised text-left px-3 py-2.5 text-[13px] leading-relaxed text-white/90 shadow-lg ring-1 ring-white/10"
                  >
                    <div className="flex flex-col">
                      {row.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    {row.breakdown && (
                      <dl className="flex w-full flex-col gap-1 border-t border-white/10 pt-3">
                        {row.breakdown.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-6">
                            <dt>{item.label}</dt>
                            <dd className="font-mono tabular-nums">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </TooltipContent>
                </Tooltip>
              </dt>
              <dd className="font-mono tabular-nums text-white/90">{row.value}</dd>
            </div>
          ))}
        </dl>
      </TooltipProvider>
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          className="h-10 flex-1 rounded-md bg-raised text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          {t('充值', 'Deposit')}
        </button>
        <button
          type="button"
          className="h-10 flex-1 rounded-md bg-raised text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          {t('划转', 'Transfer')}
        </button>
      </div>
    </section>
  )
}
