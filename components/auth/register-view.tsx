'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Building2, Check, Eye, EyeOff, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { FieldShell, TopBar } from '@/components/auth/login-view'
import { RegisterWelcomePanel } from '@/components/auth/register-welcome-panel'
import { type SessionUser, useSession } from '@/hooks/use-session'
import { ApiRequestError, apiFetch, nextPathFromLocation } from '@/lib/api-client'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { EMAIL_RE, PAPER_TRADING, PASSWORD_MAX, PASSWORD_MIN, passwordIssue } from '@/lib/paper-trading'

type AccountType = 'personal' | 'business'

function AccountTypeCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: LucideIcon
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group relative flex w-full flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all sm:p-7 ${
        selected
          ? 'border-gold bg-gold/[0.06] shadow-[0_0_40px_-16px_var(--color-gold)]'
          : 'border-foreground/12 bg-panel hover:border-gold/50'
      }`}
    >
      <span
        className={`flex size-12 items-center justify-center rounded-xl transition-colors ${
          selected ? 'bg-gold text-gold-deep' : 'bg-raised text-gold group-hover:bg-gold/15'
        }`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-2">
        <span className="text-xl font-bold text-foreground">{title}</span>
        <span className="text-pretty text-[15px] leading-relaxed text-foreground/60">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`absolute right-5 top-5 flex size-6 items-center justify-center rounded-full border transition-colors ${
          selected ? 'border-gold bg-gold text-gold-deep' : 'border-foreground/25'
        }`}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  )
}

const inputClass =
  'h-full w-full bg-transparent text-[15px] text-foreground placeholder:text-foreground/40 focus:outline-none'

function CredentialsForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const ids = useId()
  const router = useRouter()
  const session = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialFunds = Object.entries(PAPER_TRADING.initialBalances)
    .map(([asset, amount]) => `${Number(amount).toLocaleString('en-US')} ${asset}`)
    .join(' + ')

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email.trim())) return t('请输入有效的邮箱地址', 'Please enter a valid email address')
    const issue = passwordIssue(password)
    if (issue === 'length') return t(`密码长度需为 ${PASSWORD_MIN}–${PASSWORD_MAX} 位`, `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters`)
    if (issue === 'mix') return t('密码需同时包含字母和数字', 'Password must include both letters and digits')
    if (password !== confirm) return t('两次输入的密码不一致', 'Passwords do not match')
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setPending(true)
    setError(null)
    try {
      const { user } = await apiFetch<{ user: SessionUser }>('/api/auth/register', {
        method: 'POST',
        body: { email: email.trim(), password },
      })
      await session.refresh({ user }, { revalidate: false })
      router.replace(nextPathFromLocation())
    } catch (err) {
      setError(err instanceof ApiRequestError ? t(err.zh, err.en) : t('注册失败，请稍后重试', 'Sign-up failed. Please try again.'))
      setPending(false)
    }
  }

  return (
    <motion.form
      noValidate
      onSubmit={onSubmit}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full max-w-[440px] flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('返回选择账号类型', 'Back to account type')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <h1 className="font-display text-5xl tracking-wide text-foreground">{t('个人注册', 'Personal Sign Up')}</h1>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor={`${ids}-email`} className="sr-only">
          {t('邮箱', 'Email')}
        </label>
        <FieldShell>
          <input
            id={`${ids}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('请输入邮箱', 'Enter your email')}
            className={inputClass}
          />
        </FieldShell>

        <label htmlFor={`${ids}-password`} className="sr-only">
          {t('密码', 'Password')}
        </label>
        <FieldShell>
          <input
            id={`${ids}-password`}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            maxLength={PASSWORD_MAX}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('设置密码', 'Create a password')}
            aria-describedby={`${ids}-password-hint`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('隐藏密码', 'Hide password') : t('显示密码', 'Show password')}
            className="flex size-8 shrink-0 items-center justify-center text-foreground/50 transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </FieldShell>

        <label htmlFor={`${ids}-confirm`} className="sr-only">
          {t('确认密码', 'Confirm password')}
        </label>
        <FieldShell>
          <input
            id={`${ids}-confirm`}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            maxLength={PASSWORD_MAX}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t('再次输入密码', 'Confirm password')}
            className={inputClass}
          />
        </FieldShell>
        <p id={`${ids}-password-hint`} className="text-[13px] text-foreground/50">
          {t(`${PASSWORD_MIN}–${PASSWORD_MAX} 位，须同时包含字母和数字`, `${PASSWORD_MIN}–${PASSWORD_MAX} characters, with letters and digits`)}
        </p>
      </div>

      <p className="rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-[13px] leading-relaxed text-gold-light">
        {t(
          `注册后获得 ${initialFunds} 模拟资金，仅用于模拟交易，不能充值或提现。`,
          `New accounts get ${initialFunds} in virtual funds for paper trading only. They cannot be deposited or withdrawn.`,
        )}
      </p>

      <button
        type="submit"
        disabled={pending || !email || !password || !confirm}
        className="h-14 rounded-xl bg-gold text-base font-bold text-gold-deep transition-all hover:bg-gold-light hover:shadow-[0_0_32px_-8px_var(--color-gold)] disabled:cursor-not-allowed disabled:bg-raised disabled:text-foreground/35 disabled:shadow-none"
      >
        {pending ? t('注册中…', 'Creating account…') : t('注册', 'Sign Up')}
      </button>

      <p role="alert" className="-mt-2 min-h-5 text-center text-sm text-down">
        {error}
      </p>

      <p className="-mt-4 text-center text-sm text-foreground/60">
        {t('已有账号？', 'Already have an account?')}{' '}
        <Link href="/login" className="font-bold text-gold transition-colors hover:text-gold-light">
          {t('立即登录', 'Log in now')}
        </Link>
      </p>
    </motion.form>
  )
}

function RegisterForm() {
  const { t } = useI18n()
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [step, setStep] = useState<'type' | 'credentials'>('type')

  const options: { key: AccountType; icon: LucideIcon; title: string; description: string }[] = [
    {
      key: 'personal',
      icon: UserRound,
      title: t('个人注册', 'Personal Account'),
      description: t('适合个人用户快速开展业务', 'For individuals who want to get started quickly'),
    },
    {
      key: 'business',
      icon: Building2,
      title: t('企业注册', 'Business Account'),
      description: t(
        '适合企业和机构，支持在更多国家和地区开展业务',
        'For companies and institutions, available in more countries and regions',
      ),
    },
  ]

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountType) return
    if (accountType === 'personal') {
      setNotice(null)
      setStep('credentials')
      return
    }
    setNotice(t('企业注册即将开放，敬请期待。', 'Business sign-up is coming soon. Stay tuned.'))
  }

  if (step === 'credentials') return <CredentialsForm onBack={() => setStep('type')} />

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex w-full max-w-[440px] flex-col gap-8"
    >
      <h1 className="text-balance font-display text-5xl tracking-wide text-foreground">
        {t('选择账号类型', 'Choose Account Type')}
      </h1>

      <div role="radiogroup" aria-label={t('账号类型', 'Account type')} className="flex flex-col gap-4">
        {options.map((option) => (
          <AccountTypeCard
            key={option.key}
            icon={option.icon}
            title={option.title}
            description={option.description}
            selected={accountType === option.key}
            onSelect={() => {
              setAccountType(option.key)
              setNotice(null)
            }}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={!accountType}
        className="h-14 rounded-xl bg-gold text-base font-bold text-gold-deep transition-all hover:bg-gold-light hover:shadow-[0_0_32px_-8px_var(--color-gold)] disabled:cursor-not-allowed disabled:bg-raised disabled:text-foreground/35 disabled:shadow-none"
      >
        {t('下一步', 'Next')}
      </button>

      <p aria-live="polite" className="-mt-4 min-h-5 text-center text-sm text-gold-light">
        {notice}
      </p>

      <p className="-mt-6 text-center text-sm text-foreground/60">
        {t('已有账号？', 'Already have an account?')}{' '}
        <Link href="/login" className="font-bold text-gold transition-colors hover:text-gold-light">
          {t('立即登录', 'Log in now')}
        </Link>
      </p>
    </motion.form>
  )
}

export function RegisterView() {
  return (
    <I18nProvider title={{ zh: '注册 | OXXX', en: 'Sign Up | OXXX' }}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <TopBar />
        <main className="flex flex-1">
          <RegisterWelcomePanel />
          <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
            <RegisterForm />
          </section>
        </main>
      </div>
    </I18nProvider>
  )
}
