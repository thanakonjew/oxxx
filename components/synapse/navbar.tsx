'use client'

import { motion } from 'framer-motion'
import { Crown, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from '@/hooks/use-session'
import { useI18n } from '@/lib/i18n'
import { LanguageSwitcher } from './language-switcher'
import { MobileNavMenu } from './mobile-nav-menu'
import { DesktopNavMenu } from './nav-menu'
import { SquashHamburger } from './squash-hamburger'

function LogoPill() {
  const { t } = useI18n()
  return (
    <motion.a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      aria-label={t('OXXX 返回顶部', 'OXXX, back to top')}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
  className="flex h-10 shrink-0 items-center bg-transparent md:h-12"
  >
  <span aria-hidden="true" className="logo-glow inline-flex">
  <span className="logo-wordmark font-display text-[30px] leading-none tracking-[0.04em] md:text-[38px]">
  OXXX
  </span>
  </span>
  </motion.a>
  )
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </a>
  )
}

export function Navbar({ visible }: { visible: boolean }) {
  const { t } = useI18n()
  const { user, logout } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-x-0 top-0 z-50 h-20 w-full bg-transparent"
    >
      <nav aria-label="Primary" className="relative flex h-full items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <LogoPill />
          <div className="hidden md:block">
            <DesktopNavMenu />
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? t('关闭菜单', 'Close menu') : t('打开菜单', 'Open menu')}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-[12px] bg-white/15 text-white backdrop-blur-md md:hidden"
          >
            <SquashHamburger open={mobileOpen} mobile />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/vip"
            className="hidden h-12 items-center gap-2 rounded-full border border-gold/60 px-5 text-[15px] text-gold transition-all hover:border-gold hover:bg-gold/10 hover:shadow-[0_0_24px_-6px_var(--color-gold)] xl:flex"
          >
            <Crown className="size-4" aria-hidden="true" />
            {t('VIP礼遇通道', 'VIP Access')}
          </a>
          {user ? (
            <>
              <a
                href="/trade/BTCUSDT"
                title={user.email}
                className="hidden h-12 items-center rounded-full bg-white/15 px-5 text-[15px] text-white backdrop-blur-md transition-colors hover:bg-white/25 md:flex"
              >
                {t('模拟交易', 'Paper Trading')}
              </a>
              <motion.button
                type="button"
                onClick={() => void logout()}
                whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
                whileTap={{ scale: 0.97 }}
                className="flex h-10 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black md:h-12 md:px-6 md:text-[15px]"
              >
                {t('退出', 'Log Out')}
              </motion.button>
            </>
          ) : (
            <>
              <a
                href="/register"
                className="hidden h-12 items-center rounded-full bg-white/15 px-5 text-[15px] text-white backdrop-blur-md transition-colors hover:bg-white/25 md:flex"
              >
                {t('注册', 'Sign Up')}
              </a>
              <motion.a
                href="/login"
                whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
                whileTap={{ scale: 0.97 }}
                className="flex h-10 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black md:h-12 md:px-6 md:text-[15px]"
              >
                {t('登录', 'Log In')}
              </motion.a>
            </>
          )}
          <div className="hidden items-center gap-1 border-l border-white/15 pl-2 lg:flex">
            <IconButton label={t('下载 App', 'Download App')}>
              <Download className="size-5" aria-hidden="true" />
            </IconButton>
            <LanguageSwitcher />
          </div>
        </div>

        <MobileNavMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </nav>
    </motion.header>
  )
}
