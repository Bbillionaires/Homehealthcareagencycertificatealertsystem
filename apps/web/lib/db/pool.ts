import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

/**
 * Single shared connection pool for the app's Postgres database (a
 * Railway Postgres service in production). Reused across hot reloads in
 * dev via a global, same trick Next.js apps use for Prisma.
 */
export const pool: Pool =
  globalThis.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}
