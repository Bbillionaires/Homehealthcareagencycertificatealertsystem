import { Resend } from "resend";

/**
 * Generic transactional email sender, shared by password reset and the
 * notification job. Falls back to logging the message server-side when
 * RESEND_API_KEY isn't set (local dev) rather than failing the caller --
 * there's no user-facing difference either way for password reset
 * (which never confirms whether an email exists), and for notifications
 * it keeps the nightly job idempotent and side-effect-free to test
 * without a real provider configured.
 */
export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev email] To: ${params.to}\nSubject: ${params.subject}\n\n${params.text}`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Compliance Platform <no-reply@example.com>",
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
