import type { PoolClient } from "pg";
import { sendEmail } from "@/lib/email";

export interface NotificationInput {
  organizationId: string;
  recipientUserId: string;
  recipientEmail: string | null;
  employeeId?: string | null;
  employeeCredentialId?: string | null;
  type: string;
  severity: "info" | "warning" | "urgent" | "critical";
  dedupeKey: string;
  email: { subject: string; text: string };
  /** Whether to also send an email, not just the in-app row. Defaults to true. */
  sendEmailToo?: boolean;
}

/**
 * Inserts one notification row, deduped on (organization_id,
 * dedupe_key) so re-running the nightly job (or handling the same event
 * twice) never creates a second row -- see the unique index in
 * db/migrations/0001_init.sql. Only sends the email when the insert
 * actually created a new row (`RETURNING id` comes back empty on a
 * conflict), so retries never re-send mail either.
 *
 * The index is partial (`where dedupe_key is not null`), so the WHERE
 * clause has to be repeated here verbatim -- Postgres only accepts a
 * partial index as an ON CONFLICT arbiter when the conflict clause's own
 * predicate matches it exactly; omitting it makes every insert fail with
 * "there is no unique or exclusion constraint matching the ON CONFLICT
 * specification" (42P10), which is what silently broke every call to
 * this function until caught here.
 */
export async function createNotification(client: PoolClient, input: NotificationInput): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO notifications (
       organization_id, recipient_user_id, employee_id, employee_credential_id,
       type, title, body, severity, channel, dedupe_key, sent_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (organization_id, dedupe_key) WHERE (dedupe_key IS NOT NULL) DO NOTHING
     RETURNING id`,
    [
      input.organizationId,
      input.recipientUserId,
      input.employeeId ?? null,
      input.employeeCredentialId ?? null,
      input.type,
      input.email.subject,
      input.email.text,
      input.severity,
      input.recipientEmail && input.sendEmailToo !== false ? ["in_app", "email"] : ["in_app"],
      input.dedupeKey,
    ]
  );

  const wasCreated = result.rows.length > 0;

  if (wasCreated && input.recipientEmail && input.sendEmailToo !== false) {
    await sendEmail({ to: input.recipientEmail, subject: input.email.subject, text: input.email.text });
  }

  return wasCreated;
}
