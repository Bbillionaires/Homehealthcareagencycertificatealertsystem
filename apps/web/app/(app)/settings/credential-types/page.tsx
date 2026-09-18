import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";

export default async function CredentialTypesPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const credentialTypes = await withUserContext(ctx.userId, async (client) => {
    const result = await client.query<{
      id: string;
      key: string;
      name: string;
      category: string;
      renewal_interval_value: number | null;
      renewal_interval_unit: string | null;
      is_required_default: boolean;
      is_active: boolean;
    }>(
      `SELECT id, key, name, category, renewal_interval_value, renewal_interval_unit, is_required_default, is_active
       FROM credential_types WHERE organization_id = $1 ORDER BY sort_order, name`,
      [ctx.organizationId]
    );
    return result.rows;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Credential Types</h1>
          <p className="text-sm text-slate-500">The catalog of training, background-check, and document requirements.</p>
        </div>
        <Link
          href="/settings/credential-types/new"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Add Credential Type
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Renewal</th>
              <th className="px-4 py-3">Required by Default</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {credentialTypes.map((ct) => (
              <tr key={ct.id} className={ct.is_active ? undefined : "opacity-50"}>
                <td className="px-4 py-3 font-medium text-slate-900">{ct.name}</td>
                <td className="px-4 py-3 capitalize text-slate-500">{ct.category.replace("_", " ")}</td>
                <td className="px-4 py-3 text-slate-500">
                  {ct.renewal_interval_value && ct.renewal_interval_unit
                    ? `${ct.renewal_interval_value} ${ct.renewal_interval_unit}`
                    : "Never expires"}
                </td>
                <td className="px-4 py-3 text-slate-500">{ct.is_required_default ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-slate-500">{ct.is_active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/settings/credential-types/${ct.id}/edit`} className="text-sm font-medium text-brand-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
