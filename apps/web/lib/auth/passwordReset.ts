import { randomBytes, createHash } from "crypto";
import { withDb } from "@/lib/db/context";
import { hashPassword } from "@/lib/auth/password";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a one-hour password reset token for the given user and
 * stores its hash (never the raw token) in password_reset_tokens.
 * Returns the raw token to embed in the email link.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await withDb((client) =>
    client.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
      userId,
      hashToken(token),
      expiresAt,
    ])
  );

  return token;
}

/**
 * Validates a reset token, sets the new password, marks the token used,
 * and revokes every existing session for that user (a password reset is
 * a "sign everywhere else out" event). Returns the user id on success.
 */
export async function consumePasswordResetToken(token: string, newPassword: string): Promise<string | null> {
  return withDb(async (client) => {
    const result = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`,
      [hashToken(token)]
    );
    const row = result.rows[0];
    if (!row) return null;

    const passwordHash = await hashPassword(newPassword);
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, row.user_id]);
    await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [row.id]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [row.user_id]);

    return row.user_id;
  });
}
