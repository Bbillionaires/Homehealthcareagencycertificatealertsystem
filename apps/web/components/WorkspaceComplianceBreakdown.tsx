import Link from "next/link";
import { summarizeRoster, type EmployeeWithCompliance } from "@/lib/data/compliance";
import type { WorkspaceSummary } from "@/lib/workspaces";

/**
 * "Compliance by workspace" section of the org-wide "All Workspaces"
 * dashboard -- per-workspace counts without exposing that workspace's
 * industry-specific requirement details inline (just the same
 * status-count shape every workspace dashboard already uses), per the
 * multi-industry architecture directive's note not to combine
 * industry-specific detail into one confusing list.
 */
export function WorkspaceComplianceBreakdown({
  workspaces,
  roster,
  positionWorkspaceMap,
}: {
  workspaces: WorkspaceSummary[];
  roster: EmployeeWithCompliance[];
  positionWorkspaceMap: Map<string, string>;
}) {
  if (workspaces.length < 2) return null;

  const rosterByWorkspace = new Map<string, EmployeeWithCompliance[]>();
  for (const employee of roster) {
    const workspaceId = employee.positionId ? positionWorkspaceMap.get(employee.positionId) : undefined;
    if (!workspaceId) continue;
    const list = rosterByWorkspace.get(workspaceId) ?? [];
    list.push(employee);
    rosterByWorkspace.set(workspaceId, list);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Compliance by Workspace</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Workspace</th>
              <th className="px-4 py-2">Employees</th>
              <th className="px-4 py-2">Compliant</th>
              <th className="px-4 py-2">Expiring Soon</th>
              <th className="px-4 py-2">Urgent</th>
              <th className="px-4 py-2">Expired</th>
              <th className="px-4 py-2">Missing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workspaces.map((w) => {
              const counts = summarizeRoster(rosterByWorkspace.get(w.id) ?? []);
              return (
                <tr key={w.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/app/${w.slug}/dashboard`} className="hover:underline">
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{counts.total}</td>
                  <td className="px-4 py-2">{counts.compliant}</td>
                  <td className="px-4 py-2">{counts.expiringSoon}</td>
                  <td className="px-4 py-2">{counts.urgent}</td>
                  <td className="px-4 py-2">{counts.expired}</td>
                  <td className="px-4 py-2">{counts.missingDocumentation}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
