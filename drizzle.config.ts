import { defineConfig } from 'drizzle-kit'

// drizzle-kit doesn't read Next's env files, so load .env.local when it exists (Node 20.12+).
try {
  process.loadEnvFile('.env.local')
} catch {
  // No .env.local: rely on DATABASE_URL from the shell.
}

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local or the shell before running drizzle-kit')

export default defineConfig({
  schema: './lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
})
