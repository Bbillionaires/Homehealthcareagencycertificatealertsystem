import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { withUserContext } from "@/lib/db/context";
import type { RoleKey } from "@/lib/db/types";

export interface OrgContext {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: RoleKey;
  employeeId: string | null;
}

/**
 * Resolves the signed-in user's organization membership. Redirects to
 * /login if there is no session, and to /signup if the user has no
 * organization yet (shouldn't normally happen post-signup, but keeps the
 * app from rendering a broken dashboard if it does).
 *
 * NOTE: this only decides *which org/role a page renders for* -- it is a
 * UX convenience, not the sole authorization boundary. Every actual data
 * access still runs inside `withUserContext`, which is what Postgres RLS
 * keys off (see docs/ARCHITECTURE.md's note on the app_user role for the
 * one manual step that makes RLS the enforced second layer rather than
 * just app-layer checks).
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const membership = await withUserContext(user.id, async (client) => {
    const result = await client.query<{
      organization_id: string;
      employee_id: string | null;
      role_key: RoleKey;
      organization_name: string;
    }>(
      `SELECT ou.organization_id, ou.employee_id, r.key AS role_key, o.name AS organization_name
       FROM organization_users ou
       JOIN roles r ON r.id = ou.role_id
       JOIN organizations o ON o.id = ou.organization_id
       WHERE ou.user_id = $1 AND ou.is_active
       LIMIT 1`,
      [user.id]
    );
    return result.rows[0] ?? null;
  });

  if (!membership) {
    redirect("/signup");
  }

  return {
    userId: user.id,
    email: user.email,
    organizationId: membership.organization_id,
    organizationName: membership.organization_name,
    role: membership.role_key,
    employeeId: membership.employee_id,
  };
}
