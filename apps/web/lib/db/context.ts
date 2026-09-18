import type { PoolClient } from "pg";
import { pool } from "./pool";

/**
 * Runs `fn` inside a transaction with `app.current_user_id` set for the
 * duration of that transaction, which is what every RLS policy in
 * supabase/migrations/0001_init.sql keys off via `current_user_id()`.
 * Every query that touches an organization-scoped table must go through
 * this (directly, or via a helper that does) -- a plain `pool.query()`
 * has no user context set and RLS-protected reads will simply come back
 * empty.
 *
 * Pass `userId: null` for genuinely anonymous access (there is none
 * today outside of login/signup, which use `withDb` below instead since
 * `users`/`sessions` aren't RLS-protected in the first place).
 */
export async function withUserContext<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Plain pooled query for tables with no RLS (users, sessions, password_reset_tokens). */
export async function withDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
