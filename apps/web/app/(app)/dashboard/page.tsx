import { requireOrgContext } from "@/lib/session";
import { getOrgComplianceRoster, summarizeRoster } from "@/lib/data/compliance";
import { DashboardView } from "@/components/DashboardView";

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const roster = await getOrgComplianceRoster(ctx.userId, ctx.organizationId);
  const counts = summarizeRoster(roster);

  return (
    <DashboardView
      title="Compliance Dashboard"
      subtitle={`All workspaces · ${counts.total} employee${counts.total === 1 ? "" : "s"} · ${counts.compliant} fully compliant`}
      roster={roster}
      counts={counts}
      employeesHref="/employees"
    />
  );
}
