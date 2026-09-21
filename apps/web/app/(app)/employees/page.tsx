import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { getOrgComplianceRoster } from "@/lib/data/compliance";
import { withUserContext } from "@/lib/db/context";
import { StatusBadge } from "@/components/StatusBadge";
import type { OverallStatusKey } from "@compliance/shared";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    positionId?: string;
    departmentId?: string;
    employmentStatus?: string;
    includeInactive?: string;
  }>;
}) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const isAdmin = ctx.role === "owner" || ctx.role === "office_manager";

  const includeInactive = params.includeInactive === "1";

  const [roster, { positions, departments }] = await Promise.all([
    getOrgComplianceRoster(ctx.userId, ctx.organizationId, { includeInactive }),
    withUserContext(ctx.userId, async (client) => {
      const [positionsResult, departmentsResult] = await Promise.all([
        client.query<{ id: string; name: string }>(
          "SELECT id, name FROM positions WHERE organization_id = $1 ORDER BY name",
          [ctx.organizationId]
        ),
        client.query<{ id: string; name: string }>(
          "SELECT id, name FROM departments WHERE organization_id = $1 ORDER BY name",
          [ctx.organizationId]
        ),
      ]);
      return { positions: positionsResult.rows, departments: departmentsResult.rows };
    }),
  ]);

  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status as OverallStatusKey | undefined;

  const filtered = roster.filter((employee) => {
    const matchesQuery =
      !query ||
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(query) ||
      employee.employeeNumber.toLowerCase().includes(query) ||
      (employee.positionName ?? "").toLowerCase().includes(query) ||
      (employee.departmentName ?? "").toLowerCase().includes(query);
    const matchesStatus = !statusFilter || employee.compliance.overallStatus === statusFilter;
    const matchesPosition = !params.positionId || employee.positionId === params.positionId;
    const matchesDepartment = !params.departmentId || employee.departmentId === params.departmentId;
    const matchesEmploymentStatus = !params.employmentStatus || employee.employmentStatus === params.employmentStatus;
    return matchesQuery && matchesStatus && matchesPosition && matchesDepartment && matchesEmploymentStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">{filtered.length} of {roster.length} shown</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Link
              href="/import/employees"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import CSV
            </Link>
            <Link
              href="/employees/new"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Add Employee
            </Link>
          </div>
        )}
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
          name="positionId"
          defaultValue={params.positionId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          name="departmentId"
          defaultValue={params.departmentId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          name="employmentStatus"
          defaultValue={params.employmentStatus ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All employment statuses</option>
          <option value="active">Active</option>
          <option value="leave">Leave</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All compliance statuses</option>
          <option value="CURRENT">Current</option>
          <option value="EXPIRING_SOON">Expiring Soon</option>
          <option value="URGENT">Urgent</option>
          <option value="EXPIRED">Expired</option>
          <option value="MISSING">Missing</option>
          <option value="NOT_APPLICABLE">No Requirements Assigned</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="includeInactive" value="1" defaultChecked={includeInactive} />
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
                    <StatusBadge
                      color={employee.compliance.color}
                      icon={employee.compliance.icon}
                      label={
                        employee.compliance.overallStatus === "NOT_APPLICABLE"
                          ? employee.compliance.label
                          : `${employee.compliance.label} (${employee.compliance.completionPercentage}%)`
                      }
                    />
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
