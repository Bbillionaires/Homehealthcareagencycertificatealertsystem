import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";

export default async function PositionsPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const positions = await withUserContext(ctx.userId, async (client) => {
    const result = await client.query<{ id: string; name: string; description: string | null; requirement_count: number }>(
      `SELECT p.id, p.name, p.description, count(pr.id)::int AS requirement_count
       FROM positions p
       LEFT JOIN position_requirements pr ON pr.position_id = p.id
       WHERE p.organization_id = $1
       GROUP BY p.id, p.name, p.description
       ORDER BY p.name`,
      [ctx.organizationId]
    );
    return result.rows;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Positions</h1>
          <p className="text-sm text-slate-500">Each position&apos;s required and optional credentials drive its employees&apos; compliance checklist.</p>
        </div>
        <Link href="/settings/positions/new" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Add Position
        </Link>
      </div>

      {positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No positions have been added yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Configured Credentials</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {positions.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.description ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{p.requirement_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/settings/positions/${p.id}/requirements`} className="text-sm font-medium text-brand-600 hover:underline">
                      Manage Requirements
                    </Link>
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
