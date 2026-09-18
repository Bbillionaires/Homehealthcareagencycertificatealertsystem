import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { getEmployeeDetail } from "@/lib/data/employeeDetail";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateLong } from "@compliance/shared";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const detail = await getEmployeeDetail(ctx.userId, ctx.organizationId, id);

  if (!detail) notFound();

  const { employee, credentials, compliance } = detail;
  const isAdmin = ctx.role === "owner" || ctx.role === "office_manager";
  const nextExpiring = credentials
    .filter((c) => c.expirationDate)
    .sort((a, b) => (a.expirationDate! < b.expirationDate! ? -1 : 1))[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {employee.firstName} {employee.lastName}
            {employee.preferredName && <span className="ml-2 text-base text-slate-400">&ldquo;{employee.preferredName}&rdquo;</span>}
          </h1>
          <p className="text-sm text-slate-500">
            {employee.employeeNumber} · {employee.positionName ?? "No position"} · {employee.departmentName ?? "No department"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href={`/employees/${employee.id}/edit`} className="text-sm font-medium text-brand-600 hover:underline">
              Edit
            </Link>
          )}
          <StatusBadge color={compliance.color} icon={compliance.icon} label={compliance.label} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Compliance" value={`${compliance.completionPercentage}%`} sub={`${compliance.currentCount} of ${compliance.requiredCount} current`} />
        <SummaryCard
          label="Next Expiration"
          value={nextExpiring?.expirationDate ? formatDateLong(nextExpiring.expirationDate) : "—"}
          sub={nextExpiring?.credentialTypeName ?? "None scheduled"}
        />
        <SummaryCard label="Missing" value={String(compliance.results.filter((r) => r.status === "MISSING").length)} sub="required items" />
        <SummaryCard label="Urgent / Expired" value={String(compliance.results.filter((r) => r.status === "URGENT" || r.status === "EXPIRED").length)} sub="need immediate attention" />
      </div>

      {compliance.reasons.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Why this employee is {compliance.label.toLowerCase()}:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
            {compliance.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Training & Credentials</h2>
        </div>
        {credentials.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">This position has no configured credential requirements yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Credential</th>
                <th className="px-5 py-3">Completed</th>
                <th className="px-5 py-3">Expires</th>
                <th className="px-5 py-3">Status</th>
                {isAdmin && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {compliance.results.map((result) => {
                const credential = credentials.find((c) => c.credentialTypeId === result.credentialTypeId);
                return (
                  <tr key={result.credentialTypeId}>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {result.credentialTypeName}
                      {!result.isRequired && <span className="ml-2 text-xs font-normal text-slate-400">optional</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{credential?.completionDate ? formatDateLong(credential.completionDate) : "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{result.expirationDate ? formatDateLong(result.expirationDate) : credential?.completionDate ? "Never" : "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge color={result.color} icon={result.icon} label={result.label} />
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/employees/${employee.id}/credentials/${result.credentialTypeId}/renew`}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          {credential?.activeRecordId ? "Renew" : "Add"}
                        </Link>
                        {ctx.role === "owner" && credential?.activeRecordId && (
                          <Link
                            href={`/employees/${employee.id}/credentials/${result.credentialTypeId}/override`}
                            className="ml-3 text-sm font-medium text-amber-700 hover:underline"
                          >
                            Override
                          </Link>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Overview</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Detail label="Date of Hire" value={formatDateLong(employee.dateOfHire)} />
          <Detail label="Employment Status" value={employee.employmentStatus} />
          <Detail label="Phone" value={employee.phone ?? "—"} />
          <Detail label="Email" value={employee.email ?? "—"} />
        </dl>
        {employee.notes && <p className="mt-4 text-sm text-slate-600">{employee.notes}</p>}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="capitalize text-slate-700">{value}</dd>
    </div>
  );
}
