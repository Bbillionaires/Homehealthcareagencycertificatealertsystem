import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { RenewCredentialForm } from "./RenewCredentialForm";

export default async function RenewCredentialPage({
  params,
}: {
  params: Promise<{ id: string; credentialTypeId: string }>;
}) {
  const { id, credentialTypeId } = await params;
  const ctx = await requireOrgContext();

  const { employee, credentialType } = await withUserContext(ctx.userId, async (client) => {
    const [employeeResult, credentialTypeResult] = await Promise.all([
      client.query<{ id: string; first_name: string; last_name: string }>(
        "SELECT id, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2",
        [id, ctx.organizationId]
      ),
      client.query<{
        id: string;
        name: string;
        requires_document: boolean;
        renewal_interval_value: number | null;
        renewal_interval_unit: "days" | "months" | "years" | null;
      }>(
        "SELECT id, name, requires_document, renewal_interval_value, renewal_interval_unit FROM credential_types WHERE id = $1 AND organization_id = $2",
        [credentialTypeId, ctx.organizationId]
      ),
    ]);
    return { employee: employeeResult.rows[0] ?? null, credentialType: credentialTypeResult.rows[0] ?? null };
  });

  if (!employee || !credentialType) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Renew {credentialType.name}</h1>
        <p className="text-sm text-slate-500">
          {employee.first_name} {employee.last_name}
          {credentialType.renewal_interval_value && credentialType.renewal_interval_unit
            ? ` · renews every ${credentialType.renewal_interval_value} ${credentialType.renewal_interval_unit}`
            : " · does not expire once completed"}
        </p>
      </div>
      <RenewCredentialForm
        employeeId={employee.id}
        credentialTypeId={credentialType.id}
        credentialTypeName={credentialType.name}
        requiresDocument={credentialType.requires_document}
      />
    </div>
  );
}
