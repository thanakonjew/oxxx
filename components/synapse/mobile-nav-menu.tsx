'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/hooks/use-session'
import { useI18n } from '@/lib/i18n'
import { NAV_GROUPS } from './nav-data'
import { NavItemRow } from './nav-menu'

export function MobileNavMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { user } = useSession()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-nav-panel"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-x-4 top-full max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-white/10 bg-gold-deep/95 p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:inset-x-6 md:hidden"
        >
          <ul className="flex flex-col">
            {NAV_GROUPS.map((group) => {
              if (!group.items) {
                return (
                  <li key={group.key}>
                    <a
                href={group.href}
                {...(group.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={onClose}
                      className="flex h-12 items-center rounded-xl px-3 text-[15px] text-white/90 hover:bg-white/[0.06]"
                    >
                      {t(group.label)}
                    </a>
                  </li>
                )
              }
              const isOpen = expanded === group.key
              return (
                <li key={group.key}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : group.key)}
                    className={`flex h-12 w-full items-center justify-between rounded-xl px-3 text-[15px] hover:bg-white/[0.06] ${
                      isOpen ? 'text-gold' : 'text-white/90'
                    }`}
                  >
                    {t(group.label)}
                    <ChevronDown
                      className={`size-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col pb-2">
                          {group.items.map((item) => (
                            <NavItemRow key={item.id} item={item} onSelect={onClose} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex gap-2 border-t border-white/10 p-2 pt-4">
            <a
              href="/vip"
              className="flex h-11 flex-1 items-center justify-center rounded-full border border-gold/60 text-[14px] text-gold"
            >
              {t('VIP礼遇通道', 'VIP Access')}
            </a>
            {user ? (
              <a
                href="/trade/BTCUSDT"
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-white/10 text-[14px] text-white"
              >
                {t('模拟交易', 'Paper Trading')}
              </a>
            ) : (
              <a
                href="/register"
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-white/10 text-[14px] text-white"
              >
                {t('注册', 'Sign Up')}
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
