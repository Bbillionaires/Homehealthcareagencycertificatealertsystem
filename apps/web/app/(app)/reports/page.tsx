import { requireOrgContext } from "@/lib/session";
import { PhaseStub } from "@/components/PhaseStub";

export default async function ReportsPage() {
  const ctx = await requireOrgContext();
  if (ctx.role === "employee") {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Reports are available to Owners and Office Managers.
      </div>
    );
  }
  return (
    <PhaseStub
      title="Reports"
      phase="Phase 8"
      description="Employee/Expiring/Expired/Missing-Documentation/Background-Check/Training/Department/New-Hire reports with CSV and PDF export are planned for the reporting phase."
    />
  );
}
