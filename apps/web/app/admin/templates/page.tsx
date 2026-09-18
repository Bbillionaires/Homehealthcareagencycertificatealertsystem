import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { withDb } from "@/lib/db/context";
import { logoutAction } from "../../(auth)/actions";

/**
 * Read-only starting point for the platform-admin template management
 * area (docs/ARCHITECTURE.md §16): every industry, and every template
 * definition/version under it, across ALL organizations -- there's no
 * organization_id on any of these tables, and none of them have RLS
 * (see db/migrations/0003_multi_industry.sql's comments on why they're
 * reference data, not tenant data). Creating/editing/publishing
 * templates from this page is a later phase; today an admin still adds
 * template content directly against the database, the same way this
 * session added the Healthcare defaults and the other industries'
 * draft scaffolds.
 */
export default async function AdminTemplatesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/dashboard");

  const industries = await withDb(async (client) => {
    const result = await client.query<{
      id: string;
      key: string;
      name: string;
      is_custom: boolean;
    }>("SELECT id, key, name, is_custom FROM industry_definitions ORDER BY sort_order");
    return result.rows;
  });

  const templates = await withDb(async (client) => {
    const result = await client.query<{
      industry_definition_id: string;
      definition_id: string;
      definition_key: string;
      definition_name: string;
      definition_status: string;
      version_id: string;
      version_number: number;
      version_status: string;
      source: string | null;
      requirement_count: number;
      position_count: number;
    }>(
      `SELECT td.industry_definition_id, td.id AS definition_id, td.key AS definition_key,
              td.name AS definition_name, td.status AS definition_status,
              tv.id AS version_id, tv.version_number, tv.status AS version_status, tv.source,
              (SELECT count(*)::int FROM template_requirements tr WHERE tr.template_version_id = tv.id) AS requirement_count,
              (SELECT count(*)::int FROM template_positions tp WHERE tp.template_version_id = tv.id) AS position_count
       FROM template_definitions td
       JOIN template_versions tv ON tv.template_definition_id = td.id
       ORDER BY td.industry_definition_id, td.key, tv.version_number`
    );
    return result.rows;
  });

  const templatesByIndustry = new Map<string, typeof templates>();
  for (const t of templates) {
    const list = templatesByIndustry.get(t.industry_definition_id) ?? [];
    list.push(t);
    templatesByIndustry.set(t.industry_definition_id, list);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Platform Admin · Templates</h1>
            <p className="mt-1 text-sm text-slate-500">
              Every industry and its template versions, across all organizations. Read-only for now.
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              Sign out
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {industries.map((industry) => {
            const rows = templatesByIndustry.get(industry.id) ?? [];
            return (
              <section key={industry.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {industry.name}
                  {industry.is_custom && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      custom
                    </span>
                  )}
                </h2>
                {rows.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No templates yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {rows.map((t) => (
                      <li key={t.version_id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">
                            {t.definition_name} · v{t.version_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t.requirement_count} requirement{t.requirement_count === 1 ? "" : "s"} ·{" "}
                            {t.position_count} position{t.position_count === 1 ? "" : "s"}
                            {t.source ? ` · ${t.source}` : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                            t.version_status === "published"
                              ? "bg-compliance-green-bg text-compliance-green-text"
                              : t.version_status === "retired"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {t.version_status === "draft" ? "Draft / Unverified" : t.version_status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
