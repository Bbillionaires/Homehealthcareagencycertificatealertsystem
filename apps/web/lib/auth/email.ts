import { Resend } from "resend";

/**
 * Sends the password-reset email via Resend when RESEND_API_KEY is
 * configured. In local development without a key, the link is logged
 * server-side instead of failing the request outright -- there's no
 * user-facing difference either way (the reset flow never confirms
 * whether an email exists), but a developer can still complete the flow
 * without setting up an email provider.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Compliance Platform <no-reply@example.com>",
    to,
    subject: "Reset your password",
    text: `We received a request to reset your password. Reset it here (link expires in 1 hour): ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
  });
}
