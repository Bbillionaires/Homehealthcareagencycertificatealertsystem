import { randomUUID } from "node:crypto";
import { DEFAULT_CREDENTIAL_TYPES, INDUSTRIES, type IndustryKey } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { recordAuditLog } from "@/lib/audit";
import { slugWithSuffix, slugify } from "@/lib/slug";

/**
 * Bootstraps a brand-new organization: the org row, the Owner membership
 * for the user who signed up, default settings, the nine
 * initially-required credential types, and -- per the multi-industry
 * architecture (docs/ARCHITECTURE.md) -- a first industry workspace for
 * whichever industry they picked at signup, with that same owner as its
 * workspace_admin. Order matters under RLS: the org row and the owner's
 * own membership row are each covered by a bootstrap-specific INSERT
 * policy that doesn't require existing membership (see
 * db/migrations/0001_init.sql), but everything after that -- settings,
 * the workspace, credential types, the audit entry -- relies on that
 * membership already existing in the same transaction so the regular
 * is_org_admin()/is_org_member()/is_org_owner() policies pass normally.
 */
export async function bootstrapOrganization(params: {
  organizationName: string;
  industry: IndustryKey;
  ownerUserId: string;
}): Promise<string> {
  return withUserContext(params.ownerUserId, async (client) => {
    // Generated here rather than left to the table's default and read back
    // via RETURNING: at this point there's no membership row yet, so the
    // organizations_select policy (is_org_member) can't see the new row --
    // RETURNING would fail with "new row violates row-level security
    // policy" even though the insert itself is allowed. Knowing the id
    // upfront sidesteps needing to read it back at all. Same reasoning
    // applies to the industry_workspaces insert below.
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

    const industry = INDUSTRIES.find((i) => i.key === params.industry);
    if (!industry) throw new Error(`Unknown industry: ${params.industry}`);

    const industryDefResult = await client.query<{ id: string }>(
      "SELECT id FROM industry_definitions WHERE key = $1",
      [industry.key]
    );
    const industryDefinitionId = industryDefResult.rows[0]?.id;
    if (!industryDefinitionId) throw new Error(`industry_definitions row missing for key: ${industry.key}`);

    const workspaceId = randomUUID();
    await client.query(
      `INSERT INTO industry_workspaces (id, organization_id, industry_definition_id, name, slug, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [workspaceId, organizationId, industryDefinitionId, industry.name, slugify(industry.key)]
    );

    const workspaceAdminRoleResult = await client.query<{ id: string }>(
      "SELECT id FROM roles WHERE key = 'workspace_admin'"
    );
    const workspaceAdminRoleId = workspaceAdminRoleResult.rows[0]?.id;
    if (!workspaceAdminRoleId) throw new Error("workspace_admin role not found");

    await client.query(
      "INSERT INTO workspace_memberships (workspace_id, user_id, role_id) VALUES ($1, $2, $3)",
      [workspaceId, params.ownerUserId, workspaceAdminRoleId]
    );

    for (const ct of DEFAULT_CREDENTIAL_TYPES) {
      await client.query(
        `INSERT INTO credential_types (
           organization_id, workspace_id, key, name, category, renewal_interval_value,
           renewal_interval_unit, requires_document, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          organizationId,
          workspaceId,
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
      newValue: { name: params.organizationName, industry: industry.key },
    });

    return organizationId;
  });
}
