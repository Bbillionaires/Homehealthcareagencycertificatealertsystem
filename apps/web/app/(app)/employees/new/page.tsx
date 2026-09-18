import { requireOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { NewEmployeeForm } from "./NewEmployeeForm";

export default async function NewEmployeePage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  const [{ data: positions }, { data: departments }] = await Promise.all([
    supabase.from("positions").select("id, name").eq("organization_id", ctx.organizationId).order("name"),
    supabase.from("departments").select("id, name").eq("organization_id", ctx.organizationId).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Add Employee</h1>
      <NewEmployeeForm positions={positions ?? []} departments={departments ?? []} />
    </div>
  );
}
