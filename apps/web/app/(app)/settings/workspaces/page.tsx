import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { listWorkspaces } from "@/lib/workspaces";
import { AddWorkspaceForm } from "./AddWorkspaceForm";

export default async function WorkspacesSettingsPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const workspaces = await listWorkspaces(ctx.userId, ctx.organizationId);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Industry Workspaces</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each workspace is a self-contained set of positions, requirements, and reports for one industry. Employees
          can belong to more than one workspace without a second account.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workspaces.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                <td className="px-4 py-3 text-slate-500">{w.industryName}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/app/${w.slug}/dashboard`} className="text-sm font-medium text-brand-600 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Add Workspace</h2>
        <AddWorkspaceForm existingIndustryKeys={workspaces.map((w) => w.industryKey)} />
      </div>
    </div>
  );
}
