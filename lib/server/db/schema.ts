import { index, integer, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// All amounts use numeric(38, 18) and come back from the driver as strings; see lib/server/paper-math.ts.
const amount = (name: string) => numeric(name, { precision: 38, scale: 18 })
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const orderSide = pgEnum('order_side', ['buy', 'sell'])
export const orderType = pgEnum('order_type', ['limit', 'market'])
export const orderStatus = pgEnum('order_status', ['open', 'filled', 'canceled'])
export const liquidity = pgEnum('liquidity', ['maker', 'taker'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Stored trimmed and lower-cased. */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: createdAt(),
})

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the session token; the raw token only lives in the user's cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const balances = pgTable(
  'balances',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    asset: text('asset').notNull(),
    available: amount('available').notNull().default('0'),
    locked: amount('locked').notNull().default('0'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.asset] })],
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    side: orderSide('side').notNull(),
    type: orderType('type').notNull(),
    /** Limit price; null for market orders. */
    price: amount('price'),
    quantity: amount('quantity').notNull(),
    status: orderStatus('status').notNull(),
    /** Asset and amount frozen while the order rests; zero once it fills or is canceled. */
    lockedAsset: text('locked_asset'),
    lockedAmount: amount('locked_amount').notNull().default('0'),
    filledPrice: amount('filled_price'),
    fee: amount('fee'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('orders_user_status_idx').on(t.userId, t.status), index('orders_user_created_idx').on(t.userId, t.createdAt)],
)

export const fills = pgTable(
  'fills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    side: orderSide('side').notNull(),
    price: amount('price').notNull(),
    quantity: amount('quantity').notNull(),
    fee: amount('fee').notNull(),
    feeAsset: text('fee_asset').notNull(),
    liquidity: liquidity('liquidity').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('fills_user_created_idx').on(t.userId, t.createdAt)],
)

export type OrderRow = typeof orders.$inferSelect
export type FillRow = typeof fills.$inferSelect
export type BalanceRow = typeof balances.$inferSelect
