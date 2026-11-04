'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Download, Eye, EyeOff, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { LanguageSwitcher } from '@/components/synapse/language-switcher'
import DitherVeil from '@/components/react-bits/dither-veil'
import { type SessionUser, useSession } from '@/hooks/use-session'
import { ApiRequestError, apiFetch, nextPathFromLocation } from '@/lib/api-client'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { EMAIL_RE } from '@/lib/paper-trading'

type Method = 'email' | 'phone'

const PHONE_RE = /^\d{6,15}$/

const DIAL_CODES = ['+86', '+852', '+65', '+1', '+44', '+81'] as const

export function TopBar() {
  const { t } = useI18n()
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6 md:px-8">
      <Link href="/" aria-label={t('OXXX 首页', 'OXXX home')} className="flex items-center">
        <span aria-hidden="true" className="logo-glow inline-flex">
          <span className="logo-wordmark font-display text-[28px] leading-none tracking-[0.04em]">OXXX</span>
        </span>
      </Link>
      <div className="flex items-center gap-1">
        <a
          href="#"
          aria-label={t('下载 App', 'Download App')}
          className="flex size-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Download className="size-5" aria-hidden="true" />
        </a>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
        <LanguageSwitcher />
      </div>
    </header>
  )
}

export function WelcomePanel() {
  const { t } = useI18n()
  return (
    <section className="relative hidden flex-1 flex-col overflow-hidden bg-panel px-10 pt-16 lg:flex xl:px-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 flex flex-col gap-4"
      >
        <h2 className="text-balance font-display text-5xl leading-tight tracking-wide text-foreground xl:text-6xl">
          {t('欢迎来到', 'Welcome to')} <span className="text-gold">OXXX</span>
        </h2>
        <p className="max-w-md text-pretty text-[15px] leading-relaxed text-foreground/60">
          {t(
            '为专业级投资者打造的加密友好型证券平台，提供统一市场交易服务',
            'A crypto-friendly securities platform built for professional investors, with unified multi-market trading.',
          )}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
        className="relative -mx-10 mt-10 min-h-0 flex-1 xl:-mx-16"
        aria-hidden="true"
      >
        <DitherVeil inkColor="#0d0b0c" src="https://images.unsplash.com/photo-1737071371043-761e02b1ef95?q=80&w=1400&auto=format&fit=crop" />
      </motion.div>
    </section>
  )
}

export function FieldShell({ children, invalid }: { children: React.ReactNode; invalid?: boolean }) {
  return (
    <div
      className={`flex h-14 items-center gap-2 rounded-xl border bg-raised px-4 transition-colors focus-within:border-gold/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_18%,transparent)] ${
        invalid ? 'border-down/70' : 'border-transparent'
      }`}
    >
      {children}
    </div>
  )
}

function LoginForm() {
  const { t } = useI18n()
  const ids = useId()
  const router = useRouter()
  const session = useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState<Method>('email')
  const [step, setStep] = useState<'account' | 'password'>('account')
  const [email, setEmail] = useState('')
  const [dial, setDial] = useState<(typeof DIAL_CODES)[number]>('+86')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const account = method === 'email' ? email.trim() : `${dial} ${phone}`
  const accountValid = method === 'email' ? EMAIL_RE.test(email.trim()) : PHONE_RE.test(phone)
  const showAccountError = touched && !accountValid && (method === 'email' ? email : phone).length > 0

  const switchMethod = (next: Method) => {
    setMethod(next)
    setTouched(false)
    setNotice(null)
    setError(null)
  }

  const onAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!accountValid) return
    setError(null)
    if (method === 'phone') {
      setNotice(t('手机号登录即将开放，请先使用邮箱登录。', 'Phone sign-in is coming soon. Please use email for now.'))
      return
    }
    setNotice(null)
    setStep('password')
  }

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || pending) return
    setPending(true)
    setError(null)
    try {
      const { user } = await apiFetch<{ user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      })
      await session.refresh({ user }, { revalidate: false })
      router.replace(nextPathFromLocation())
    } catch (err) {
      setError(err instanceof ApiRequestError ? t(err.zh, err.en) : t('登录失败，请稍后重试', 'Sign-in failed. Please try again.'))
      setPending(false)
    }
  }

  const tabs: { key: Method; label: string }[] = [
    { key: 'email', label: t('邮箱', 'Email') },
    { key: 'phone', label: t('手机', 'Phone') },
  ]

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-8">
      <h1 className="font-display text-5xl tracking-wide text-foreground">{t('登录', 'Log In')}</h1>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'account' ? (
          <motion.form
            key="account"
            noValidate
            onSubmit={onAccountSubmit}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div role="tablist" aria-label={t('登录方式', 'Sign-in method')} className="flex gap-8">
              {tabs.map((tab) => {
                const active = tab.key === method
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchMethod(tab.key)}
                    className={`relative pb-3 text-lg transition-colors ${
                      active ? 'font-bold text-foreground' : 'text-foreground/50 hover:text-foreground/80'
                    }`}
                  >
                    {tab.label}
                    {active && (
                      <motion.span
                        layoutId="login-tab-indicator"
                        className="absolute inset-x-1/4 bottom-0 h-0.5 rounded-full bg-gold"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2">
              {method === 'email' ? (
                <>
                  <label htmlFor={`${ids}-email`} className="sr-only">
                    {t('邮箱', 'Email')}
                  </label>
                  <FieldShell invalid={showAccountError}>
                    <input
                      id={`${ids}-email`}
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder={t('请输入邮箱', 'Enter your email')}
                      aria-invalid={showAccountError}
                      aria-describedby={showAccountError ? `${ids}-account-error` : undefined}
                      className="h-full w-full bg-transparent text-[15px] text-foreground placeholder:text-foreground/40 focus:outline-none"
                    />
                  </FieldShell>
                </>
              ) : (
                <>
                  <label htmlFor={`${ids}-phone`} className="sr-only">
                    {t('手机号', 'Phone number')}
                  </label>
                  <FieldShell invalid={showAccountError}>
                    <label htmlFor={`${ids}-dial`} className="sr-only">
                      {t('国家区号', 'Country code')}
                    </label>
                    <select
                      id={`${ids}-dial`}
                      value={dial}
                      onChange={(e) => setDial(e.target.value as (typeof DIAL_CODES)[number])}
                      className="h-full shrink-0 cursor-pointer bg-transparent pr-1 text-[15px] text-foreground focus:outline-none"
                    >
                      {DIAL_CODES.map((code) => (
                        <option key={code} value={code} className="bg-raised">
                          {code}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" className="h-5 w-px bg-foreground/15" />
                    <input
                      id={`${ids}-phone`}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      autoFocus
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => setTouched(true)}
                      placeholder={t('请输入手机号', 'Enter your phone number')}
                      aria-invalid={showAccountError}
                      aria-describedby={showAccountError ? `${ids}-account-error` : undefined}
                      className="h-full w-full bg-transparent text-[15px] text-foreground placeholder:text-foreground/40 focus:outline-none"
                    />
                  </FieldShell>
                </>
              )}
              <p id={`${ids}-account-error`} role="alert" className="min-h-5 text-[13px] text-down">
                {showAccountError &&
                  (method === 'email'
                    ? t('请输入有效的邮箱地址', 'Please enter a valid email address')
                    : t('请输入有效的手机号', 'Please enter a valid phone number'))}
              </p>
            </div>

            <button
              type="submit"
              disabled={!accountValid}
              className="h-14 rounded-xl bg-gold text-base font-bold text-gold-deep transition-all hover:bg-gold-light hover:shadow-[0_0_32px_-8px_var(--color-gold)] disabled:cursor-not-allowed disabled:bg-raised disabled:text-foreground/35 disabled:shadow-none"
            >
              {t('下一步', 'Next')}
            </button>

            <div className="flex items-center gap-4" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-sm text-foreground/60">{t('或', 'or')}</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <button
              type="button"
              onClick={() =>
                setNotice(t('通行密钥登录即将开放，敬请期待。', 'Passkey sign-in is coming soon. Stay tuned.'))
              }
              className="flex h-14 items-center justify-center gap-2 rounded-xl border border-foreground/15 text-[15px] text-foreground transition-colors hover:border-gold/60 hover:text-gold-light"
            >
              <KeyRound className="size-5" aria-hidden="true" />
              {t('使用通行密钥登录', 'Log in with passkey')}
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="password"
            noValidate
            onSubmit={onPasswordSubmit}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div className="flex items-center gap-3 rounded-xl bg-raised/60 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setStep('account')
                  setPassword('')
                  setNotice(null)
                  setError(null)
                }}
                aria-label={t('返回修改账号', 'Back to change account')}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="truncate text-[15px] text-foreground">{account}</span>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={`${ids}-password`} className="sr-only">
                {t('密码', 'Password')}
              </label>
              <FieldShell>
                <input
                  id={`${ids}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('请输入密码', 'Enter your password')}
                  className="h-full w-full bg-transparent text-[15px] text-foreground placeholder:text-foreground/40 focus:outline-none"
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
              <div className="flex justify-end">
                <a href="#" className="text-[13px] text-foreground/60 transition-colors hover:text-gold">
                  {t('忘记密码？', 'Forgot password?')}
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={password.length < 8 || pending}
              className="h-14 rounded-xl bg-gold text-base font-bold text-gold-deep transition-all hover:bg-gold-light hover:shadow-[0_0_32px_-8px_var(--color-gold)] disabled:cursor-not-allowed disabled:bg-raised disabled:text-foreground/35 disabled:shadow-none"
            >
              {pending ? t('登录中…', 'Logging in…') : t('登录', 'Log In')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <p aria-live="polite" className={`min-h-5 text-center text-sm ${error ? 'text-down' : 'text-gold-light'}`}>
        {error ?? notice}
      </p>

      <p className="-mt-6 text-center text-sm text-foreground/60">
        {t('还没有账号？', "Don't have an account?")}{' '}
        <Link href="/register" className="font-bold text-gold transition-colors hover:text-gold-light">
          {t('立即注册', 'Sign up now')}
        </Link>
      </p>
    </div>
  )
}

function LoginContent() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex flex-1">
        <WelcomePanel />
        <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <LoginForm />
        </section>
      </main>
    </div>
  )
}

export function LoginView() {
  return (
    <I18nProvider title={{ zh: '登录 | OXXX', en: 'Log In | OXXX' }}>
      <LoginContent />
    </I18nProvider>
  )
}
