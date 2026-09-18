import { DEFAULT_CREDENTIAL_TYPES } from "@compliance/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { slugWithSuffix } from "@/lib/slug";

/**
 * Bootstraps a brand-new organization: the org row, default settings, the
 * nine initially-required credential types, and the Owner membership for
 * the user who signed up. Runs on the admin (service-role) client because
 * the caller has no membership yet for RLS to key off — this is the one
 * place that's true. Everything after this point goes through the
 * regular RLS-scoped client.
 */
export async function bootstrapOrganization(
  admin: SupabaseClient<Database>,
  params: { organizationName: string; ownerUserId: string }
): Promise<string> {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: params.organizationName, slug: slugWithSuffix(params.organizationName) })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(orgError?.message ?? "Failed to create organization");
  }

  const organizationId = org.id;

  const { error: settingsError } = await admin
    .from("organization_settings")
    .insert({ organization_id: organizationId });
  if (settingsError) throw new Error(settingsError.message);

  const { error: credentialTypesError } = await admin.from("credential_types").insert(
    DEFAULT_CREDENTIAL_TYPES.map((ct) => ({
      organization_id: organizationId,
      key: ct.key,
      name: ct.name,
      category: ct.category,
      renewal_interval_value: ct.renewalIntervalValue,
      renewal_interval_unit: ct.renewalIntervalUnit,
      requires_document: ct.requiresDocument,
      sort_order: ct.sortOrder,
    }))
  );
  if (credentialTypesError) throw new Error(credentialTypesError.message);

  const { data: ownerRole, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("key", "owner")
    .single();
  if (roleError || !ownerRole) throw new Error(roleError?.message ?? "Owner role not found");

  const { error: membershipError } = await admin.from("organization_users").insert({
    organization_id: organizationId,
    user_id: params.ownerUserId,
    role_id: ownerRole.id,
  });
  if (membershipError) throw new Error(membershipError.message);

  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: params.ownerUserId,
    action: "organization.created",
    entity_type: "organization",
    entity_id: organizationId,
    new_value: { name: params.organizationName },
  });

  return organizationId;
}
