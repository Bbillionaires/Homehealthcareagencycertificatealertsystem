import { Pool } from "pg";
import "./pgTypeParsers";

declare global {
  // eslint-disable-next-line no-var
  var __pgJobPool: Pool | undefined;
}

/**
 * Separate connection for cross-organization background work (the
 * nightly notification check). RLS scopes every policy to a single
 * user's membership in a single org via current_user_id() (see
 * docs/ARCHITECTURE.md §2) -- there's no "current user" for a job that
 * has to read every organization, so this can't run through the
 * app's own least-privileged `app_user` connection (db/create_app_role.sql).
 * In production, point JOB_DATABASE_URL at a connection that bypasses
 * RLS (the migration-owner role, or a dedicated role with BYPASSRLS
 * granted). It falls back to DATABASE_URL so local dev -- where that's
 * still the unrestricted owner connection -- needs no extra setup.
 */
export const jobPool: Pool =
  globalThis.__pgJobPool ??
  new Pool({
    connectionString: process.env.JOB_DATABASE_URL || process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgJobPool = jobPool;
}
