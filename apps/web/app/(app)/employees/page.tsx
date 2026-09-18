import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getOrgComplianceRoster } from "@/lib/data/compliance";
import { StatusBadge } from "@/components/StatusBadge";
import type { CredentialStatusKey } from "@compliance/shared";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; includeInactive?: string }>;
}) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const supabase = await createClient();

  const roster = await getOrgComplianceRoster(supabase, ctx.organizationId, {
    includeInactive: params.includeInactive === "1",
  });

  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status as CredentialStatusKey | undefined;

  const filtered = roster.filter((employee) => {
    const matchesQuery =
      !query ||
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(query) ||
      employee.employeeNumber.toLowerCase().includes(query) ||
      (employee.positionName ?? "").toLowerCase().includes(query) ||
      (employee.departmentName ?? "").toLowerCase().includes(query);
    const matchesStatus = !statusFilter || employee.compliance.overallStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">{filtered.length} of {roster.length} shown</p>
        </div>
        <Link
          href="/employees/new"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Add Employee
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search name, employee ID, position, department…"
          className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="CURRENT">Current</option>
          <option value="EXPIRING_SOON">Expiring Soon</option>
          <option value="URGENT">Urgent</option>
          <option value="EXPIRED">Expired</option>
          <option value="MISSING">Missing</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="includeInactive" value="1" defaultChecked={params.includeInactive === "1"} />
          Include inactive/terminated
        </label>
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
          Apply
        </button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState hasAnyEmployees={roster.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/employees/${employee.id}`} className="font-medium text-slate-900 hover:underline">
                      {employee.firstName} {employee.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{employee.employeeNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{employee.positionName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{employee.departmentName ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{employee.employmentStatus}</td>
                  <td className="px-4 py-3">
                    <StatusBadge color={employee.compliance.color} icon={employee.compliance.icon} label={`${employee.compliance.label} (${employee.compliance.completionPercentage}%)`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAnyEmployees }: { hasAnyEmployees: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm text-slate-500">
        {hasAnyEmployees
          ? "No employees match the selected filters."
          : "No employees have been added yet."}
      </p>
    </div>
  );
}
