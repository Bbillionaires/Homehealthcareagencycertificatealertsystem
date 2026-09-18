"use server";

import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function updateOrgSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can change organization settings." };
  }

  const yellow = Number(formData.get("complianceYellowThresholdDays"));
  const orange = Number(formData.get("complianceOrangeThresholdDays"));
  const scheduleRaw = String(formData.get("notifyScheduleDays") ?? "");

  if (!Number.isInteger(yellow) || yellow <= 0) {
    return { error: "The green/yellow threshold must be a positive number of days." };
  }
  if (!Number.isInteger(orange) || orange <= 0) {
    return { error: "The yellow/orange threshold must be a positive number of days." };
  }
  if (orange >= yellow) {
    return { error: "The orange threshold must be smaller than the yellow threshold." };
  }

  const notifyScheduleDays = scheduleRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (notifyScheduleDays.some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "Notification schedule must be a comma-separated list of non-negative whole days." };
  }

  try {
    await withUserContext(ctx.userId, async (client) => {
      const previousResult = await client.query(
        "SELECT compliance_yellow_threshold_days, compliance_orange_threshold_days, notify_schedule_days FROM organization_settings WHERE organization_id = $1",
        [ctx.organizationId]
      );
      const previous = previousResult.rows[0];

      await client.query(
        `UPDATE organization_settings SET
           compliance_yellow_threshold_days = $1,
           compliance_orange_threshold_days = $2,
           notify_schedule_days = $3
         WHERE organization_id = $4`,
        [yellow, orange, notifyScheduleDays, ctx.organizationId]
      );

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "organization_settings.updated",
        entityType: "organization_settings",
        entityId: ctx.organizationId,
        previousValue: previous ?? null,
        newValue: {
          compliance_yellow_threshold_days: yellow,
          compliance_orange_threshold_days: orange,
          notify_schedule_days: notifyScheduleDays,
        },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update settings." };
  }

  return { success: true };
}
