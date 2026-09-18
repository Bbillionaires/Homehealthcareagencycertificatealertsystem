import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext, type OrgContext } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { DEFAULT_CREDENTIAL_TYPES, INDUSTRIES, type IndustryKey } from "@compliance/shared";

export type WorkspaceRoleKey = "workspace_admin" | "workspace_manager" | "workspace_employee";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  industryKey: string;
  industryName: string;
  role: WorkspaceRoleKey;
}

/**
 * Every industry workspace the signed-in user can access in their
 * organization: an explicit workspace_memberships row, or -- for an
 * organization owner -- every workspace in the org (see
 * is_workspace_member() in db/migrations/0003_multi_industry.sql, which
 * this mirrors instead of relying on RLS to filter, since we also need
 * the role for display).
 */
export async function listWorkspaces(userId: string, organizationId: string): Promise<WorkspaceSummary[]> {
  return withUserContext(userId, async (client) => {
    const result = await client.query<{
      id: string;
      name: string;
      slug: string;
      industry_key: string;
      industry_name: string;
      role_key: WorkspaceRoleKey | null;
      is_owner: boolean;
    }>(
      `SELECT w.id, w.name, w.slug, i.key AS industry_key, i.name AS industry_name,
              r.key AS role_key,
              EXISTS (
                SELECT 1 FROM organization_users ou
                JOIN roles orole ON orole.id = ou.role_id
                WHERE ou.organization_id = w.organization_id
                  AND ou.user_id = $1
                  AND ou.is_active
                  AND orole.key = 'owner'
              ) AS is_owner
       FROM industry_workspaces w
       JOIN industry_definitions i ON i.id = w.industry_definition_id
       LEFT JOIN workspace_memberships wm ON wm.workspace_id = w.id AND wm.user_id = $1 AND wm.is_active
       LEFT JOIN roles r ON r.id = wm.role_id
       WHERE w.organization_id = $2 AND w.status = 'active'
       ORDER BY w.created_at ASC`,
      [userId, organizationId]
    );

    return result.rows
      .filter((row) => row.is_owner || row.role_key)
      .map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        industryKey: row.industry_key,
        industryName: row.industry_name,
        role: row.is_owner ? "workspace_admin" : (row.role_key as WorkspaceRoleKey),
      }));
  });
}

export interface WorkspaceContext extends OrgContext {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  industryKey: string;
  industryName: string;
  workspaceRole: WorkspaceRoleKey;
}

/**
 * Resolves the org context (see lib/session.ts) plus a specific
 * workspace by slug. Redirects to /login or /signup for the same
 * reasons requireOrgContext does, and to the org's first workspace if
 * the slug doesn't match one the user can access -- covers both a typo
 * and someone trying another org's workspace slug (industry_workspaces
 * slugs are only unique per-organization, not globally).
 */
export async function requireWorkspaceContext(workspaceSlug: string): Promise<WorkspaceContext> {
  const ctx = await requireOrgContext();
  const workspaces = await listWorkspaces(ctx.userId, ctx.organizationId);
  const workspace = workspaces.find((w) => w.slug === workspaceSlug);

  if (!workspace) {
    if (workspaces.length > 0) {
      redirect(`/app/${workspaces[0].slug}/dashboard`);
    }
    redirect("/signup");
  }

  return {
    ...ctx,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    industryKey: workspace.industryKey,
    industryName: workspace.industryName,
    workspaceRole: workspace.role,
  };
}

/** The workspace an unqualified "/dashboard"-style link should resolve to. */
export async function getDefaultWorkspace(userId: string, organizationId: string): Promise<WorkspaceSummary | null> {
  const workspaces = await listWorkspaces(userId, organizationId);
  return workspaces[0] ?? null;
}

/**
 * Adds a new industry workspace to an existing organization (Settings ->
 * Industry Workspaces -> Add Workspace) -- same shape as the workspace
 * bootstrapOrganization creates at signup (lib/organizations.ts), minus
 * the organization/owner-membership steps, which already exist. Only an
 * organization owner may call this (enforced by the caller checking
 * ctx.role, and independently by RLS's industry_workspaces_write policy).
 */
export async function createWorkspace(params: {
  organizationId: string;
  ownerUserId: string;
  industry: IndustryKey;
}): Promise<WorkspaceSummary> {
  return withUserContext(params.ownerUserId, async (client) => {
    const industry = INDUSTRIES.find((i) => i.key === params.industry);
    if (!industry) throw new Error(`Unknown industry: ${params.industry}`);

    const industryDefResult = await client.query<{ id: string }>(
      "SELECT id FROM industry_definitions WHERE key = $1",
      [industry.key]
    );
    const industryDefinitionId = industryDefResult.rows[0]?.id;
    if (!industryDefinitionId) throw new Error(`industry_definitions row missing for key: ${industry.key}`);

    const existingSlugsResult = await client.query<{ slug: string }>(
      "SELECT slug FROM industry_workspaces WHERE organization_id = $1",
      [params.organizationId]
    );
    const existingSlugs = new Set(existingSlugsResult.rows.map((r) => r.slug));
    let slug = slugify(industry.key);
    if (existingSlugs.has(slug)) {
      let suffix = 2;
      while (existingSlugs.has(`${slug}-${suffix}`)) suffix += 1;
      slug = `${slug}-${suffix}`;
    }

    const workspaceId = randomUUID();
    await client.query(
      `INSERT INTO industry_workspaces (id, organization_id, industry_definition_id, name, slug, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [workspaceId, params.organizationId, industryDefinitionId, industry.name, slug]
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

    // See lib/organizations.ts's bootstrapOrganization for why this is
    // Healthcare-only: DEFAULT_CREDENTIAL_TYPES is a healthcare-specific
    // list, not a generic starter set.
    if (industry.key === "healthcare") {
      for (const ct of DEFAULT_CREDENTIAL_TYPES) {
        await client.query(
          `INSERT INTO credential_types (
             organization_id, workspace_id, key, name, category, renewal_interval_value,
             renewal_interval_unit, requires_document, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            params.organizationId,
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
    }

    return {
      id: workspaceId,
      name: industry.name,
      slug,
      industryKey: industry.key,
      industryName: industry.name,
      role: "workspace_admin",
    };
  });
}

