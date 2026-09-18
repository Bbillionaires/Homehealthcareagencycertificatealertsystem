import { requireOrgContext } from "@/lib/session";
import { getOrgComplianceRoster, summarizeRoster } from "@/lib/data/compliance";
import { listWorkspaces, getPositionWorkspaceMap } from "@/lib/workspaces";
import { DashboardView } from "@/components/DashboardView";
import { WorkspaceComplianceBreakdown } from "@/components/WorkspaceComplianceBreakdown";

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const [roster, workspaces, positionWorkspaceMap] = await Promise.all([
    getOrgComplianceRoster(ctx.userId, ctx.organizationId),
    listWorkspaces(ctx.userId, ctx.organizationId),
    getPositionWorkspaceMap(ctx.userId, ctx.organizationId),
  ]);
  const counts = summarizeRoster(roster);

  return (
    <div className="space-y-8">
      <DashboardView
        title="Compliance Dashboard"
        subtitle={`All workspaces · ${counts.total} employee${counts.total === 1 ? "" : "s"} · ${counts.compliant} fully compliant`}
        roster={roster}
        counts={counts}
        employeesHref="/employees"
      />
      <WorkspaceComplianceBreakdown workspaces={workspaces} roster={roster} positionWorkspaceMap={positionWorkspaceMap} />
    </div>
  );
}
