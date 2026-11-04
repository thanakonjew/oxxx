'use client'

import { Percent } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { MarketSnapshot } from '@/hooks/use-okx-market'
import { type PaperOrder, availableOf, usePaperAccount } from '@/hooks/use-paper-account'
import { useSession } from '@/hooks/use-session'
import { ApiRequestError, apiFetch, loginHref } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { type Market, formatNumber } from '@/lib/markets'
import { PAPER_TRADING } from '@/lib/paper-trading'
import { cn } from '@/lib/utils'

const LEVERAGES = [3, 5, 10, 20] as const
const SUCCESS_NOTE_MS = 4000

const percent = (rate: string) => `${Number((Number(rate) * 100).toFixed(4))}%`

/** Counts decimal places in a typed amount such as "0.125". */
const decimalsIn = (value: string) => value.split('.')[1]?.length ?? 0

/** Turns partial input like "1." or ".5" into the plain form the API accepts ("1", "0.5"). */
const normalizeAmount = (value: string) => value.trim().replace(/\.$/, '').replace(/^\./, '0.')

export function PaperBadge() {
  const { t } = useI18n()
  return (
    <span className="rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[11px] font-bold text-gold-light">
      {t('模拟交易', 'Paper')}
    </span>
  )
}

function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string
  unit: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2.5 transition-colors focus-within:bg-white/[0.08] focus-within:ring-1 focus-within:ring-gold/60', disabled && 'opacity-60')}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] text-white/40">{label}</span>
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value.replace(/[^\d.]/g, ''))}
          className="w-full bg-transparent text-[15px] tabular-nums text-white placeholder:text-white/30 focus:outline-none"
        />
      </span>
      <span className="text-sm text-white/80">{unit}</span>
    </label>
  )
}

export function OrderForm({
  market,
  snapshot,
  leverage,
  onLeverageChange,
  isPerpetual = false,
}: {
  market: Market
  snapshot: MarketSnapshot
  leverage: number | null
  onLeverageChange: (v: number | null) => void
  isPerpetual?: boolean
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const { user } = useSession()
  const account = usePaperAccount(Boolean(user))
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [type, setType] = useState<'limit' | 'market'>('limit')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  // A success note describes the order just placed; it goes stale once that order fills or is canceled.
  useEffect(() => {
    if (message?.kind !== 'success') return
    const timer = setTimeout(() => setMessage(null), SUCCESS_NOTE_MS)
    return () => clearTimeout(timer)
  }, [message])

  const spendAsset = side === 'buy' ? market.quote : market.base
  const available = availableOf(account.balances, spendAsset)

  // Paper trading covers spot only; say why the button is disabled instead of hiding it.
  const blockedReason = isPerpetual
    ? t('模拟交易暂只支持现货', 'Paper trading supports spot only for now')
    : leverage !== null
      ? t('模拟交易暂不支持杠杆，请关闭杠杆开关', 'Paper trading has no margin yet. Turn off Margin.')
      : null

  const validationError = (): string | null => {
    if (!(Number(amount) > 0)) return t('请输入数量', 'Enter an amount')
    if (decimalsIn(amount) > market.qtyDp) return t(`数量最多 ${market.qtyDp} 位小数`, `Amount allows at most ${market.qtyDp} decimals`)
    if (type === 'limit') {
      if (!(Number(price) > 0)) return t('请输入价格', 'Enter a price')
      if (decimalsIn(price) > market.priceDp) return t(`价格最多 ${market.priceDp} 位小数`, `Price allows at most ${market.priceDp} decimals`)
    }
    return null
  }

  const submit = async () => {
    if (blockedReason || pending) return
    const problem = validationError()
    if (problem) {
      setMessage({ kind: 'error', text: problem })
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const { order } = await apiFetch<{ order: PaperOrder }>('/api/orders', {
        method: 'POST',
        body: {
          symbol: market.symbol,
          side,
          type,
          quantity: normalizeAmount(amount),
          ...(type === 'limit' ? { price: normalizeAmount(price) } : {}),
        },
      })
      setMessage({
        kind: 'success',
        text:
          order.status === 'filled'
            ? t(`已成交，均价 ${order.filledPrice} ${market.quote}`, `Filled at ${order.filledPrice} ${market.quote}`)
            : t('委托已挂单，可在「当前委托」查看', 'Order placed. See Open Orders.'),
      })
      setAmount('')
      await account.refresh()
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof ApiRequestError ? t(err.zh, err.en) : t('下单失败，请稍后重试', 'Order failed. Please try again.'),
      })
    } finally {
      setPending(false)
    }
  }

  const last = snapshot.lastPrice ?? snapshot.tickers[market.symbol]?.last ?? null
  const effectivePrice = type === 'market' ? last : Number(price) || last
  const total = effectivePrice && Number(amount) ? effectivePrice * Number(amount) * (leverage ? 1 / leverage : 1) : null

  const quick = [
    { label: t('最新价', 'Last'), value: last },
    { label: t('卖一价', 'Ask'), value: snapshot.asks[0]?.price },
    { label: t('买一价', 'Bid'), value: snapshot.bids[0]?.price },
    { label: '-1%', value: last ? last * 0.99 : undefined },
    { label: '+1%', value: last ? last * 1.01 : undefined },
  ]

  return (
    <section aria-label={t('下单', 'Place order')} className="flex h-full flex-col gap-4 rounded-lg bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
          {isPerpetual ? t('永续合约', 'Perpetual') : leverage ? t('杠杆', 'Margin') : t('现货', 'Spot')}
          <PaperBadge />
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={leverage !== null}
          onClick={() => onLeverageChange(leverage ? null : 10)}
          className="flex items-center gap-2 text-sm text-white/80"
        >
          {t('杠杆', 'Margin')}
          <span className={cn('relative h-5 w-9 rounded-full transition-colors', leverage ? 'bg-gold' : 'bg-white/20')}>
            <span className={cn('absolute top-0.5 size-4 rounded-full bg-foreground transition-transform', leverage ? 'translate-x-[18px]' : 'translate-x-0.5')} />
          </span>
        </button>
      </div>

      {leverage !== null && (
        <div className="flex gap-2" role="radiogroup" aria-label={t('杠杆倍数', 'Leverage')}>
          {LEVERAGES.map((lv) => (
            <button
              key={lv}
              type="button"
              role="radio"
              aria-checked={leverage === lv}
              onClick={() => onLeverageChange(lv)}
              className={cn(
                'flex-1 rounded-md border py-1 text-xs tabular-nums transition-colors',
                leverage === lv ? 'border-gold text-gold-light' : 'border-line text-white/50 hover:text-white',
              )}
            >
              {lv}x
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 rounded-lg bg-white/[0.05] p-1">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => {
              setSide(s)
              setMessage(null)
            }}
            className={cn(
              'rounded-md py-2 text-sm font-bold transition-colors',
              side === s ? (s === 'buy' ? 'bg-up text-background' : 'bg-down text-foreground') : 'text-white/60 hover:text-white',
            )}
          >
            {s === 'buy' ? t('买入', 'Buy') : t('卖出', 'Sell')}
          </button>
        ))}
      </div>

      <div role="tablist" className="flex gap-5 border-b border-line">
        {(['limit', 'market'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={type === k}
            onClick={() => {
              setType(k)
              setMessage(null)
            }}
            className={cn(
              'relative pb-2 text-sm transition-colors',
              type === k ? 'font-bold text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold' : 'text-white/50 hover:text-white/80',
            )}
          >
            {k === 'limit' ? t('限价', 'Limit') : t('市价', 'Market')}
          </button>
        ))}
      </div>

      {type === 'limit' ? (
        <div className="flex flex-col gap-2">
          <Field label={t('价格', 'Price')} unit={market.quote} value={price} onChange={(v) => {
            setPrice(v)
            setMessage(null)
          }} placeholder={last ? last.toFixed(market.priceDp) : ''} />
          <div className="grid grid-cols-5 gap-1">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                disabled={!q.value}
                onClick={() => {
                  if (!q.value) return
                  setPrice(q.value.toFixed(market.priceDp))
                  setMessage(null)
                }}
                className="rounded-md bg-white/[0.05] py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Field label={t('价格', 'Price')} unit={market.quote} value="" placeholder={t('市场最优价', 'Best market price')} disabled />
      )}

      <Field
        label={t('数量', 'Amount')}
        unit={market.base}
        value={amount}
        onChange={(v) => {
          setAmount(v)
          setMessage(null)
        }}
        placeholder={(0).toFixed(market.qtyDp)}
      />

      <div className="flex flex-col gap-1.5 text-xs">
        {user && (
          <div className="flex items-center justify-between">
            <span className="text-white/40">{t('可用（模拟）', 'Available (paper)')}</span>
            <span className="tabular-nums text-white/80">
              {formatNumber(Number(available), spendAsset === market.quote ? 2 : market.qtyDp)} {spendAsset}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-white/40">{leverage ? t('所需保证金', 'Required margin') : t('金额', 'Total')}</span>
          <span className="tabular-nums text-white/80">
            {formatNumber(total, 2)} {market.quote}
          </span>
        </div>
      </div>

      {user ? (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={Boolean(blockedReason) || pending}
          className={cn(
            'flex h-12 items-center justify-center rounded-lg text-[15px] font-bold transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
            side === 'buy' ? 'bg-up text-background' : 'bg-down text-foreground',
          )}
        >
          {pending
            ? t('提交中…', 'Submitting…')
            : side === 'buy'
              ? t(`买入 ${market.base}`, `Buy ${market.base}`)
              : t(`卖出 ${market.base}`, `Sell ${market.base}`)}
        </button>
      ) : (
        <Link
          href={loginHref(pathname ?? `/trade/${market.symbol}`)}
          className="flex h-12 items-center justify-center rounded-lg bg-gold text-[15px] font-bold text-gold-deep transition-[filter,box-shadow] hover:shadow-[0_0_24px_-6px_var(--color-gold)] hover:brightness-110"
        >
          {t('登录 / 注册', 'Log in / Sign up')}
        </Link>
      )}

      <p
        aria-live="polite"
        className={cn('min-h-4 text-xs', blockedReason || message?.kind === 'error' ? 'text-down' : 'text-up')}
      >
        {user ? (blockedReason ?? message?.text) : null}
      </p>

      <p className="flex items-center gap-2 text-xs text-white/50">
        <Percent className="size-3.5" aria-hidden="true" />
        {t('费率等级', 'Fee tier')} · Maker {percent(PAPER_TRADING.makerFeeRate)} / Taker {percent(PAPER_TRADING.takerFeeRate)}
      </p>
    </section>
  )
}
