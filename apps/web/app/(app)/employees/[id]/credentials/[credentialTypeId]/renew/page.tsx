import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { RenewCredentialForm } from "./RenewCredentialForm";

export default async function RenewCredentialPage({
  params,
}: {
  params: Promise<{ id: string; credentialTypeId: string }>;
}) {
  const { id, credentialTypeId } = await params;
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: employee }, { data: credentialType }] = await Promise.all([
    supabase.from("employees").select("id, first_name, last_name").eq("id", id).eq("organization_id", ctx.organizationId).single(),
    supabase
      .from("credential_types")
      .select("id, name, requires_document, renewal_interval_value, renewal_interval_unit")
      .eq("id", credentialTypeId)
      .eq("organization_id", ctx.organizationId)
      .single(),
  ]);

  if (!employee || !credentialType) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Renew {credentialType.name}
        </h1>
        <p className="text-sm text-slate-500">
          {employee.first_name} {employee.last_name}
          {credentialType.renewal_interval_value && credentialType.renewal_interval_unit
            ? ` · renews every ${credentialType.renewal_interval_value} ${credentialType.renewal_interval_unit}`
            : " · does not expire once completed"}
        </p>
      </div>
      <RenewCredentialForm employeeId={employee.id} credentialTypeId={credentialType.id} requiresDocument={credentialType.requires_document} />
    </div>
  );
}
