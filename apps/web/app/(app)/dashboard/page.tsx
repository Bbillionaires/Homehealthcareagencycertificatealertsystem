import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getOrgComplianceRoster, summarizeRoster } from "@/lib/data/compliance";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_PRESENTATION } from "@compliance/shared";

const CARDS: {
  key: keyof ReturnType<typeof summarizeRoster>;
  label: string;
  status?: string;
  accent: string;
}[] = [
  { key: "total", label: "Total Employees", accent: "border-slate-200" },
  { key: "compliant", label: "Fully Compliant", status: "CURRENT", accent: "border-compliance-green-ring" },
  { key: "expiringSoon", label: "Expiring Soon", status: "EXPIRING_SOON", accent: "border-compliance-yellow-ring" },
  { key: "urgent", label: "Urgent", status: "URGENT", accent: "border-compliance-orange-ring" },
  { key: "expired", label: "Expired / Non-Compliant", status: "EXPIRED", accent: "border-compliance-red-ring" },
  { key: "missingDocumentation", label: "Missing Documentation", status: "MISSING", accent: "border-compliance-gray-ring" },
];

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();
  const roster = await getOrgComplianceRoster(supabase, ctx.organizationId);
  const counts = summarizeRoster(roster);

  const nonCompliant = roster.filter((e) => e.compliance.overallStatus !== "CURRENT");
  const upcoming = roster
    .flatMap((e) =>
      e.compliance.results
        .filter((r) => r.status === "EXPIRING_SOON" || r.status === "URGENT")
        .map((r) => ({ employee: e, result: r }))
    )
    .sort((a, b) => (a.result.daysRemaining ?? 0) - (b.result.daysRemaining ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Compliance Dashboard</h1>
        <p className="text-sm text-slate-500">
          {counts.total} employee{counts.total === 1 ? "" : "s"} · {counts.compliant} fully compliant
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.status ? `/employees?status=${card.status}` : "/employees"}
            className={`rounded-xl border-2 bg-white p-4 shadow-sm transition hover:shadow-md ${card.accent}`}
          >
            <p className="text-2xl font-bold text-slate-900">{counts[card.key]}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Upcoming Expirations</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              All active employees currently meet the selected compliance requirements.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {upcoming.map(({ employee, result }) => (
                <li key={`${employee.id}-${result.credentialTypeId}`} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link href={`/employees/${employee.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                      {employee.firstName} {employee.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">{result.credentialTypeName}</p>
                  </div>
                  <StatusBadge color={result.color} icon={result.icon} label={`${result.daysRemaining}d`} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Non-Compliant Employees</h2>
          {nonCompliant.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Every active employee is currently compliant.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {nonCompliant.slice(0, 8).map((employee) => (
                <li key={employee.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link href={`/employees/${employee.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                      {employee.firstName} {employee.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">{employee.compliance.reasons[0] ?? STATUS_PRESENTATION[employee.compliance.overallStatus].label}</p>
                  </div>
                  <StatusBadge color={employee.compliance.color} icon={employee.compliance.icon} label={employee.compliance.label} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
