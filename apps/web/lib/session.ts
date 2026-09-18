import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoleKey } from "@/lib/database.types";

export interface OrgContext {
  userId: string;
  email: string | null;
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
 * NOTE: this only decides *which org/role a page renders for* — it is a
 * UX convenience, not the authorization boundary. Every actual data
 * access is still enforced by Postgres RLS.
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_users")
    .select("organization_id, employee_id, roles(key), organizations(name)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{
      organization_id: string;
      employee_id: string | null;
      roles: { key: RoleKey } | null;
      organizations: { name: string } | null;
    }>();

  if (!membership) {
    redirect("/signup");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: membership.organization_id,
    organizationName: membership.organizations?.name ?? "",
    role: membership.roles?.key ?? "employee",
    employeeId: membership.employee_id,
  };
}
