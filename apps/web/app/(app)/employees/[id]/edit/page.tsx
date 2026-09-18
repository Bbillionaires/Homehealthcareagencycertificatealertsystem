import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { EmployeeForm, type EmployeeFormValues } from "../../EmployeeForm";
import { updateEmployeeAction } from "../../actions";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    notFound();
  }

  const { employee, positions, departments } = await withUserContext(ctx.userId, async (client) => {
    const [employeeResult, positionsResult, departmentsResult] = await Promise.all([
      client.query<{
        employee_number: string;
        first_name: string;
        middle_name: string | null;
        last_name: string;
        preferred_name: string | null;
        date_of_hire: string;
        position_id: string | null;
        department_id: string | null;
        employment_status: string;
        phone: string | null;
        email: string | null;
        notes: string | null;
      }>(
        `SELECT employee_number, first_name, middle_name, last_name, preferred_name,
                date_of_hire, position_id, department_id, employment_status, phone, email, notes
         FROM employees WHERE id = $1 AND organization_id = $2`,
        [id, ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM positions WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM departments WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
    ]);
    return {
      employee: employeeResult.rows[0] ?? null,
      positions: positionsResult.rows,
      departments: departmentsResult.rows,
    };
  });

  if (!employee) notFound();

  const defaultValues: EmployeeFormValues = {
    employeeNumber: employee.employee_number,
    firstName: employee.first_name,
    middleName: employee.middle_name ?? "",
    lastName: employee.last_name,
    preferredName: employee.preferred_name ?? "",
    dateOfHire: employee.date_of_hire,
    positionId: employee.position_id ?? "",
    departmentId: employee.department_id ?? "",
    employmentStatus: employee.employment_status,
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    notes: employee.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Edit {employee.first_name} {employee.last_name}
      </h1>
      <EmployeeForm
        action={updateEmployeeAction}
        positions={positions}
        departments={departments}
        defaultValues={defaultValues}
        employeeId={id}
        submitLabel="Save Changes"
      />
    </div>
  );
}
