import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { ImportEmployeesClient } from "./ImportEmployeesClient";

export default async function ImportEmployeesPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    redirect("/dashboard");
  }

  const { positions, departments, employeeNumbers } = await withUserContext(ctx.userId, async (client) => {
    const [positionsResult, departmentsResult, employeesResult] = await Promise.all([
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM positions WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM departments WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
      client.query<{ employee_number: string }>("SELECT employee_number FROM employees WHERE organization_id = $1", [
        ctx.organizationId,
      ]),
    ]);
    return {
      positions: positionsResult.rows,
      departments: departmentsResult.rows,
      employeeNumbers: employeesResult.rows.map((e) => e.employee_number),
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Employees</h1>
        <p className="text-sm text-slate-500">
          Upload a CSV of employees to add in bulk. Position and department names must match your
          organization&apos;s existing list exactly (leave blank if unsure) -- credential imports aren&apos;t
          supported yet, so add training/background-check records afterward.
        </p>
      </div>
      <ImportEmployeesClient positions={positions} departments={departments} existingEmployeeNumbers={employeeNumbers} />
    </div>
  );
}
