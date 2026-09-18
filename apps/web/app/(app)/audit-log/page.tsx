import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";

export default async function AuditLogPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const entries = await withUserContext(ctx.userId, async (client) => {
    const result = await client.query<{
      id: string;
      action: string;
      entity_type: string;
      created_at: string;
      new_value: Record<string, unknown> | null;
    }>(
      `SELECT id, action, entity_type, created_at, new_value
       FROM audit_logs
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [ctx.organizationId]
    );
    return result.rows;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Append-only record of every change to employee and compliance data.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No audited actions yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.action}</td>
                  <td className="px-4 py-3 text-slate-500">{entry.entity_type}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {entry.new_value ? JSON.stringify(entry.new_value) : "—"}
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
