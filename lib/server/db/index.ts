import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function connect(url: string) {
  // prepare: false keeps the client compatible with transaction-mode poolers (Neon, Supabase, PgBouncer).
  const client = postgres(url, { max: 5, prepare: false })
  return drizzle({ client, schema })
}

export type Db = ReturnType<typeof connect>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

// Reuse one pool per server instance, including across hot reloads in development.
const globalForDb = globalThis as typeof globalThis & { __oxxxDb?: Db }

/** Returns the database client, created on first use so builds don't need DATABASE_URL. */
export function getDb(): Db {
  if (!globalForDb.__oxxxDb) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    globalForDb.__oxxxDb = connect(url)
  }
  return globalForDb.__oxxxDb
}
