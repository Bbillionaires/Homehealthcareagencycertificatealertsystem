"use server";

import { redirect } from "next/navigation";
import { expirationOverrideSchema } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";

export interface ActionResult {
  error?: string;
}

export async function overrideExpirationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can override an expiration date." };
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  const parsed = expirationOverrideSchema.safeParse({
    employeeCredentialId: formData.get("employeeCredentialId"),
    newExpirationDate: formData.get("newExpirationDate"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const input = parsed.data;

  try {
    await withUserContext(ctx.userId, async (client) => {
      const previousResult = await client.query<{ expiration_date: string | null; employee_id: string }>(
        `SELECT expiration_date, employee_id FROM employee_credentials
         WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
        [input.employeeCredentialId, ctx.organizationId]
      );
      const previous = previousResult.rows[0];
      if (!previous) throw new Error("Credential record not found.");

      await client.query(
        `UPDATE employee_credentials SET
           expiration_date = $1,
           expiration_override = true,
           expiration_override_reason = $2,
           updated_by = $3
         WHERE id = $4 AND organization_id = $5`,
        [input.newExpirationDate, input.reason, ctx.userId, input.employeeCredentialId, ctx.organizationId]
      );

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "credential.expiration_overridden",
        entityType: "employee_credential",
        entityId: input.employeeCredentialId,
        affectedEmployeeId: previous.employee_id,
        previousValue: { expiration_date: previous.expiration_date },
        newValue: { expiration_date: input.newExpirationDate, reason: input.reason },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to override expiration date." };
  }

  redirect(`/employees/${employeeId}`);
}
