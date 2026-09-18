"use server";

import { redirect } from "next/navigation";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";

export interface ActionResult {
  error?: string;
}

export async function createPositionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can manage positions." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Position name is required." };

  let positionId: string;
  try {
    positionId = await withUserContext(ctx.userId, async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO positions (organization_id, name, description) VALUES ($1, $2, $3) RETURNING id",
        [ctx.organizationId, name, description || null]
      );
      const id = result.rows[0].id;

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "position.created",
        entityType: "position",
        entityId: id,
        newValue: { name },
      });

      return id;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create position.";
    if (message.includes("positions_organization_id_name_key")) {
      return { error: `A position named "${name}" already exists.` };
    }
    return { error: message };
  }

  redirect(`/settings/positions/${positionId}/requirements`);
}

export interface RequirementsResult {
  error?: string;
  success?: boolean;
}

export async function updatePositionRequirementsAction(
  _prev: RequirementsResult,
  formData: FormData
): Promise<RequirementsResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can manage position requirements." };
  }

  const positionId = String(formData.get("positionId") ?? "");
  if (!positionId) return { error: "Missing position." };

  const credentialTypeIds = formData.getAll("credentialTypeId").map(String);

  try {
    await withUserContext(ctx.userId, async (client) => {
      const positionCheck = await client.query("SELECT id FROM positions WHERE id = $1 AND organization_id = $2", [
        positionId,
        ctx.organizationId,
      ]);
      if (positionCheck.rows.length === 0) throw new Error("Position not found.");

      const changes: Record<string, string> = {};

      for (const credentialTypeId of credentialTypeIds) {
        const selection = String(formData.get(`requirement_${credentialTypeId}`) ?? "not_applicable");

        if (selection === "not_applicable") {
          await client.query(
            "DELETE FROM position_requirements WHERE position_id = $1 AND credential_type_id = $2",
            [positionId, credentialTypeId]
          );
        } else {
          const isRequired = selection === "required";
          await client.query(
            `INSERT INTO position_requirements (organization_id, position_id, credential_type_id, is_required)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (position_id, credential_type_id) DO UPDATE SET is_required = $4`,
            [ctx.organizationId, positionId, credentialTypeId, isRequired]
          );
        }
        changes[credentialTypeId] = selection;
      }

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "position_requirement.changed",
        entityType: "position",
        entityId: positionId,
        newValue: changes,
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update requirements." };
  }

  return { success: true };
}
