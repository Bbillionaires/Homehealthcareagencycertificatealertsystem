import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { formatDateLong } from "@compliance/shared";
import { OverrideExpirationForm } from "./OverrideExpirationForm";

export default async function OverrideExpirationPage({
  params,
}: {
  params: Promise<{ id: string; credentialTypeId: string }>;
}) {
  const { id, credentialTypeId } = await params;
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect(`/employees/${id}`);
  }

  const { employee, credentialType, active } = await withUserContext(ctx.userId, async (client) => {
    const [employeeResult, credentialTypeResult, activeResult] = await Promise.all([
      client.query<{ id: string; first_name: string; last_name: string }>(
        "SELECT id, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2",
        [id, ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM credential_types WHERE id = $1 AND organization_id = $2",
        [credentialTypeId, ctx.organizationId]
      ),
      client.query<{ id: string; expiration_date: string | null }>(
        `SELECT id, expiration_date FROM employee_credentials
         WHERE employee_id = $1 AND credential_type_id = $2 AND organization_id = $3 AND status = 'active'`,
        [id, credentialTypeId, ctx.organizationId]
      ),
    ]);
    return {
      employee: employeeResult.rows[0] ?? null,
      credentialType: credentialTypeResult.rows[0] ?? null,
      active: activeResult.rows[0] ?? null,
    };
  });

  if (!employee || !credentialType) notFound();
  if (!active) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Override Expiration</h1>
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {employee.first_name} {employee.last_name} has no active {credentialType.name} record to override. Add
          one first from the employee&apos;s credential list.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Override Expiration: {credentialType.name}</h1>
        <p className="text-sm text-slate-500">
          {employee.first_name} {employee.last_name} · current expiration:{" "}
          {active.expiration_date ? formatDateLong(active.expiration_date) : "none"}
        </p>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Overriding sets the expiration date directly instead of recalculating it from a renewal. A reason is
          required and this action is recorded in the audit log.
        </p>
      </div>
      <OverrideExpirationForm employeeId={employee.id} employeeCredentialId={active.id} />
    </div>
  );
}
