"use server";

import { redirect } from "next/navigation";
import { credentialTypeInputSchema, type IntervalUnit } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";

export interface ActionResult {
  error?: string;
}

function readCredentialTypeForm(formData: FormData) {
  const renewalIntervalValueRaw = String(formData.get("renewalIntervalValue") ?? "");
  const warningYellowRaw = String(formData.get("warningYellowThresholdDays") ?? "");
  const warningOrangeRaw = String(formData.get("warningOrangeThresholdDays") ?? "");
  const renewalIntervalUnitRaw = String(formData.get("renewalIntervalUnit") ?? "");

  return credentialTypeInputSchema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    renewalIntervalValue: renewalIntervalValueRaw ? Number(renewalIntervalValueRaw) : null,
    renewalIntervalUnit: renewalIntervalUnitRaw ? (renewalIntervalUnitRaw as IntervalUnit) : null,
    requiresDocument: formData.get("requiresDocument") === "on",
    isRequiredDefault: formData.get("isRequiredDefault") === "on",
    warningYellowThresholdDays: warningYellowRaw ? Number(warningYellowRaw) : null,
    warningOrangeThresholdDays: warningOrangeRaw ? Number(warningOrangeRaw) : null,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createCredentialTypeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can manage the credential type catalog." };
  }

  const parsed = readCredentialTypeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    await withUserContext(ctx.userId, async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO credential_types (
           organization_id, key, name, description, category, renewal_interval_value,
           renewal_interval_unit, requires_document, is_required_default,
           warning_yellow_threshold_days, warning_orange_threshold_days, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          ctx.organizationId,
          input.key,
          input.name,
          input.description || null,
          input.category,
          input.renewalIntervalValue,
          input.renewalIntervalUnit,
          input.requiresDocument,
          input.isRequiredDefault,
          input.warningYellowThresholdDays,
          input.warningOrangeThresholdDays,
          input.isActive,
        ]
      );

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "credential_type.created",
        entityType: "credential_type",
        entityId: result.rows[0].id,
        newValue: { key: input.key, name: input.name },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create credential type.";
    if (message.includes("credential_types_organization_id_key_key")) {
      return { error: `Key "${input.key}" is already in use.` };
    }
    return { error: message };
  }

  redirect("/settings/credential-types");
}

export async function updateCredentialTypeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can manage the credential type catalog." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing credential type." };

  const parsed = readCredentialTypeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    await withUserContext(ctx.userId, async (client) => {
      const previousResult = await client.query(
        `SELECT key, name, description, category, renewal_interval_value, renewal_interval_unit,
                requires_document, is_required_default, warning_yellow_threshold_days,
                warning_orange_threshold_days, is_active
         FROM credential_types WHERE id = $1 AND organization_id = $2`,
        [id, ctx.organizationId]
      );
      const previous = previousResult.rows[0];
      if (!previous) throw new Error("Credential type not found.");

      await client.query(
        `UPDATE credential_types SET
           name = $1, description = $2, category = $3, renewal_interval_value = $4,
           renewal_interval_unit = $5, requires_document = $6, is_required_default = $7,
           warning_yellow_threshold_days = $8, warning_orange_threshold_days = $9, is_active = $10
         WHERE id = $11 AND organization_id = $12`,
        [
          input.name,
          input.description || null,
          input.category,
          input.renewalIntervalValue,
          input.renewalIntervalUnit,
          input.requiresDocument,
          input.isRequiredDefault,
          input.warningYellowThresholdDays,
          input.warningOrangeThresholdDays,
          input.isActive,
          id,
          ctx.organizationId,
        ]
      );

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "credential_type.updated",
        entityType: "credential_type",
        entityId: id,
        previousValue: previous,
        newValue: {
          name: input.name,
          description: input.description || null,
          category: input.category,
          renewal_interval_value: input.renewalIntervalValue,
          renewal_interval_unit: input.renewalIntervalUnit,
          requires_document: input.requiresDocument,
          is_required_default: input.isRequiredDefault,
          warning_yellow_threshold_days: input.warningYellowThresholdDays,
          warning_orange_threshold_days: input.warningOrangeThresholdDays,
          is_active: input.isActive,
        },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update credential type." };
  }

  redirect("/settings/credential-types");
}
