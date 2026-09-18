import { requireOrgContext } from "@/lib/session";
import { getEmployeeDetail } from "@/lib/data/employeeDetail";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateLong } from "@compliance/shared";

export default async function ProfilePage() {
  const ctx = await requireOrgContext();

  if (!ctx.employeeId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Your account isn&apos;t linked to an employee record yet. Ask your administrator to link it.
      </div>
    );
  }

  const detail = await getEmployeeDetail(ctx.userId, ctx.organizationId, ctx.employeeId);

  if (!detail) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        We couldn&apos;t find your employee record.
      </div>
    );
  }

  const { employee, compliance, credentials } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-slate-500">{employee.positionName ?? "No position"}</p>
        </div>
        <StatusBadge color={compliance.color} icon={compliance.icon} label={compliance.label} />
      </div>

      {compliance.reasons.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Outstanding items:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
            {compliance.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">My Credentials</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Credential</th>
              <th className="px-5 py-3">Completed</th>
              <th className="px-5 py-3">Expires</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {compliance.results.map((result) => {
              const credential = credentials.find((c) => c.credentialTypeId === result.credentialTypeId);
              return (
                <tr key={result.credentialTypeId}>
                  <td className="px-5 py-3 font-medium text-slate-900">{result.credentialTypeName}</td>
                  <td className="px-5 py-3 text-slate-500">{credential?.completionDate ? formatDateLong(credential.completionDate) : "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{result.expirationDate ? formatDateLong(result.expirationDate) : "—"}</td>
                  <td className="px-5 py-3">
                    <StatusBadge color={result.color} icon={result.icon} label={result.label} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
