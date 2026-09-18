import { requireWorkspaceContext } from "@/lib/workspaces";
import { getOrgComplianceRoster, summarizeRoster } from "@/lib/data/compliance";
import { DashboardView } from "@/components/DashboardView";

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceContext(workspaceSlug);
  const roster = await getOrgComplianceRoster(ctx.userId, ctx.organizationId, { workspaceId: ctx.workspaceId });
  const counts = summarizeRoster(roster);

  return (
    <DashboardView
      title={`${ctx.workspaceName} Dashboard`}
      subtitle={`${ctx.industryName} workspace · ${counts.total} employee${counts.total === 1 ? "" : "s"} · ${counts.compliant} fully compliant`}
      roster={roster}
      counts={counts}
      employeesHref="/employees"
    />
  );
}
