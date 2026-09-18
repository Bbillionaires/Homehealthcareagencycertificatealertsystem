"use server";

import { redirect } from "next/navigation";
import { addCalendarInterval, credentialRenewalSchema, type IntervalUnit } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { createNotification } from "@/lib/notifications/dispatch";
import { renewalConfirmationEmail } from "@/lib/notifications/templates";

export interface ActionResult {
  error?: string;
}

export async function renewCredentialAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    return { error: "You don't have permission to renew credentials." };
  }

  const parsed = credentialRenewalSchema.safeParse({
    employeeId: formData.get("employeeId"),
    credentialTypeId: formData.get("credentialTypeId"),
    completionDate: formData.get("completionDate"),
    issueDate: formData.get("issueDate") || undefined,
    certificateNumber: formData.get("certificateNumber") ?? "",
    issuingOrganization: formData.get("issuingOrganization") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const input = parsed.data;

  try {
    await withUserContext(ctx.userId, async (client) => {
      const [credentialTypeResult, employeeResult] = await Promise.all([
        client.query<{
          name: string;
          renewal_interval_value: number | null;
          renewal_interval_unit: IntervalUnit | null;
        }>(
          "SELECT name, renewal_interval_value, renewal_interval_unit FROM credential_types WHERE id = $1 AND organization_id = $2",
          [input.credentialTypeId, ctx.organizationId]
        ),
        client.query<{ first_name: string; last_name: string }>(
          "SELECT first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2",
          [input.employeeId, ctx.organizationId]
        ),
      ]);
      const credentialType = credentialTypeResult.rows[0];
      const employee = employeeResult.rows[0];
      if (!credentialType) throw new Error("Credential type not found.");
      if (!employee) throw new Error("Employee not found.");

      const expirationDate =
        credentialType.renewal_interval_value && credentialType.renewal_interval_unit
          ? addCalendarInterval(input.completionDate, credentialType.renewal_interval_value, credentialType.renewal_interval_unit)
          : null;

      const renewResult = await client.query<{ renew_employee_credential: string }>(
        `SELECT renew_employee_credential($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.employeeId,
          input.credentialTypeId,
          input.completionDate,
          input.issueDate ?? null,
          expirationDate,
          input.certificateNumber || null,
          input.issuingOrganization || null,
          input.notes || null,
          ctx.userId,
        ]
      );
      const newRecordId = renewResult.rows[0].renew_employee_credential;

      const recipientsResult = await client.query<{ user_id: string; email: string }>(
        `SELECT ou.user_id, u.email
         FROM organization_users ou
         JOIN roles r ON r.id = ou.role_id
         JOIN users u ON u.id = ou.user_id
         WHERE ou.organization_id = $1 AND ou.is_active
           AND (r.key IN ('owner', 'office_manager') OR ou.employee_id = $2)`,
        [ctx.organizationId, input.employeeId]
      );

      const employeeName = `${employee.first_name} ${employee.last_name}`;
      const email = renewalConfirmationEmail({
        employeeName,
        credentialName: credentialType.name,
        completionDate: input.completionDate,
        expirationDate,
      });

      for (const recipient of recipientsResult.rows) {
        await createNotification(client, {
          organizationId: ctx.organizationId,
          recipientUserId: recipient.user_id,
          recipientEmail: recipient.email,
          employeeId: input.employeeId,
          employeeCredentialId: newRecordId,
          type: "renewal_confirmation",
          severity: "info",
          dedupeKey: `credential:${newRecordId}:renewed:${recipient.user_id}`,
          email,
        });
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save renewal." };
  }

  redirect(`/employees/${input.employeeId}`);
}
