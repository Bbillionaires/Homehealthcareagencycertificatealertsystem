import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { NewEmployeeForm } from "./NewEmployeeForm";

export default async function NewEmployeePage() {
  const ctx = await requireOrgContext();

  const { positions, departments } = await withUserContext(ctx.userId, async (client) => {
    const [positionsResult, departmentsResult] = await Promise.all([
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM positions WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM departments WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
    ]);
    return { positions: positionsResult.rows, departments: departmentsResult.rows };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Add Employee</h1>
      <NewEmployeeForm positions={positions} departments={departments} />
    </div>
  );
}
