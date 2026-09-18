"use server";

import { redirect } from "next/navigation";
import { signUpSchema, loginSchema } from "@compliance/shared";
import { withDb } from "@/lib/db/context";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { createPasswordResetToken, consumePasswordResetToken } from "@/lib/auth/passwordReset";
import { sendPasswordResetEmail } from "@/lib/auth/email";
import { bootstrapOrganization } from "@/lib/organizations";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    organizationName: formData.get("organizationName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { organizationName, fullName, email, password } = parsed.data;

  const existing = await withDb((client) => client.query("SELECT id FROM users WHERE email = $1", [email]));
  if (existing.rows.length > 0) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const userResult = await withDb((client) =>
    client.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id",
      [email, passwordHash, fullName]
    )
  );
  const userId = userResult.rows[0].id;

  try {
    await bootstrapOrganization({ organizationName, ownerUserId: userId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to set up your organization." };
  }

  await createSession(userId);
  redirect("/dashboard");
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  const result = await withDb((client) =>
    client.query<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = $1", [
      email,
    ])
  );
  const user = result.rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function requestPasswordResetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "Email is required" };

  const result = await withDb((client) => client.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]));
  const user = result.rows[0];

  // Deliberately the same response whether or not the account exists,
  // to avoid leaking which emails are registered.
  if (user) {
    const token = await createPasswordResetToken(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password/confirm?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
  }

  return { success: true };
}

export async function updatePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "This reset link is missing its token." };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const userId = await consumePasswordResetToken(token, password);
  if (!userId) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  await createSession(userId);
  redirect("/dashboard");
}
