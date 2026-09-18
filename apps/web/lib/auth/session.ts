import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { withDb } from "@/lib/db/context";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session row and sets the httpOnly cookie. Call after a successful login/signup. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await withDb((client) =>
    client.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
      userId,
      hashToken(token),
      expiresAt,
    ])
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the current session cookie to a user, or null if absent/expired/invalid. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await withDb((client) =>
    client.query<{ id: string; email: string; full_name: string; is_platform_admin: boolean }>(
      `SELECT u.id, u.email, u.full_name, u.is_platform_admin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)]
    )
  );

  const row = result.rows[0];
  if (!row) return null;

  return { id: row.id, email: row.email, fullName: row.full_name, isPlatformAdmin: row.is_platform_admin };
}

/** Deletes the current session row (if any) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await withDb((client) => client.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]));
  }

  cookieStore.delete(SESSION_COOKIE);
}
