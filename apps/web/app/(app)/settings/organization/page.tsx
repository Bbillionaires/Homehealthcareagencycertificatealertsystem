import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";

export default async function OrganizationSettingsPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const settings = await withUserContext(ctx.userId, async (client) => {
    const result = await client.query<{
      compliance_yellow_threshold_days: number;
      compliance_orange_threshold_days: number;
      notify_schedule_days: number[];
      timezone: string;
    }>(
      "SELECT compliance_yellow_threshold_days, compliance_orange_threshold_days, notify_schedule_days, timezone FROM organization_settings WHERE organization_id = $1",
      [ctx.organizationId]
    );
    return result.rows[0] ?? null;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Organization Settings</h1>
        <p className="text-sm text-slate-500">{ctx.organizationName}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Compliance Thresholds</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Green (Current)</dt>
            <dd className="text-slate-700">More than {settings?.compliance_yellow_threshold_days ?? 90} days</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Yellow (Expiring Soon)</dt>
            <dd className="text-slate-700">
              {settings?.compliance_orange_threshold_days ?? 60}–{settings?.compliance_yellow_threshold_days ?? 90} days
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Orange (Urgent)</dt>
            <dd className="text-slate-700">1–{settings?.compliance_orange_threshold_days ?? 60} days</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Red (Expired)</dt>
            <dd className="text-slate-700">0 or fewer days</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          An editable form for thresholds, notification schedule, credential types, and positions is planned for Phase 3/7 (credential & notification configuration). These values are stored per-organization in <code>organization_settings</code> today and already drive every compliance calculation.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Notification Schedule</h2>
        <p className="mt-2 text-sm text-slate-600">
          Alerts at {(settings?.notify_schedule_days ?? [90, 60, 30, 14, 7, 0]).join(", ")} days before expiration, then daily while overdue.
        </p>
      </section>
    </div>
  );
}
