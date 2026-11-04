// Paper-trading settings shared by the server and the trading UI.
// Every balance here is virtual: there are no deposits, withdrawals or real funds.

export const PAPER_TRADING = {
  /** Virtual funds granted to every new account. */
  initialBalances: { USDT: '10000' } as Readonly<Record<string, string>>,
  makerFeeRate: '0.0002',
  takerFeeRate: '0.0005',
  /** Smallest order value accepted, in the quote asset. */
  minNotional: '1',
} as const

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Password rule shared by the register form and the API: 8–64 characters with at least one letter and one digit. */
export function passwordIssue(password: string): 'length' | 'mix' | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return 'length'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'mix'
  return null
}
