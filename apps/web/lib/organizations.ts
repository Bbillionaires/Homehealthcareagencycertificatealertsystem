import { randomUUID } from "node:crypto";
import { DEFAULT_CREDENTIAL_TYPES } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { recordAuditLog } from "@/lib/audit";
import { slugWithSuffix } from "@/lib/slug";

/**
 * Bootstraps a brand-new organization: the org row, the Owner membership
 * for the user who signed up, default settings, and the nine
 * initially-required credential types. Order matters under RLS: the org
 * row and the owner's own membership row are each covered by a
 * bootstrap-specific INSERT policy that doesn't require existing
 * membership (see supabase/migrations/0001_init.sql), but everything
 * after that -- settings, credential types, the audit entry -- relies on
 * that membership already existing in the same transaction so the
 * regular is_org_admin()/is_org_member() policies pass normally.
 */
export async function bootstrapOrganization(params: {
  organizationName: string;
  ownerUserId: string;
}): Promise<string> {
  return withUserContext(params.ownerUserId, async (client) => {
    // Generated here rather than left to the table's default and read back
    // via RETURNING: at this point there's no membership row yet, so the
    // organizations_select policy (is_org_member) can't see the new row --
    // RETURNING would fail with "new row violates row-level security
    // policy" even though the insert itself is allowed. Knowing the id
    // upfront sidesteps needing to read it back at all.
    const organizationId = randomUUID();
    await client.query("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", [
      organizationId,
      params.organizationName,
      slugWithSuffix(params.organizationName),
    ]);

    const roleResult = await client.query<{ id: string }>("SELECT id FROM roles WHERE key = 'owner'");
    const ownerRoleId = roleResult.rows[0]?.id;
    if (!ownerRoleId) throw new Error("Owner role not found");

    await client.query(
      "INSERT INTO organization_users (organization_id, user_id, role_id) VALUES ($1, $2, $3)",
      [organizationId, params.ownerUserId, ownerRoleId]
    );

    await client.query("INSERT INTO organization_settings (organization_id) VALUES ($1)", [organizationId]);

    for (const ct of DEFAULT_CREDENTIAL_TYPES) {
      await client.query(
        `INSERT INTO credential_types (
           organization_id, key, name, category, renewal_interval_value,
           renewal_interval_unit, requires_document, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          ct.key,
          ct.name,
          ct.category,
          ct.renewalIntervalValue,
          ct.renewalIntervalUnit,
          ct.requiresDocument,
          ct.sortOrder,
        ]
      );
    }

    await recordAuditLog(client, {
      organizationId,
      actorUserId: params.ownerUserId,
      action: "organization.created",
      entityType: "organization",
      entityId: organizationId,
      newValue: { name: params.organizationName },
    });

    return organizationId;
  });
}
