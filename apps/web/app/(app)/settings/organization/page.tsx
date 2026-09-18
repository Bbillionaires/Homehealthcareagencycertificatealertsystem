import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { OrgSettingsForm } from "./OrgSettingsForm";

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

      <div className="flex gap-3">
        <Link href="/settings/credential-types" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Manage Credential Types
        </Link>
        <Link href="/settings/positions" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Manage Positions
        </Link>
      </div>

      <OrgSettingsForm
        yellowThresholdDays={settings?.compliance_yellow_threshold_days ?? 90}
        orangeThresholdDays={settings?.compliance_orange_threshold_days ?? 60}
        notifyScheduleDays={settings?.notify_schedule_days ?? [90, 60, 30, 14, 7, 0]}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">How thresholds map to colors</h2>
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
      </section>
    </div>
  );
}
