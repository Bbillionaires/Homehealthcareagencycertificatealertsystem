"use server";

import { redirect } from "next/navigation";
import { employeeInputSchema } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";

export interface ActionResult {
  error?: string;
}

export async function createEmployeeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    return { error: "You don't have permission to add employees." };
  }

  const parsed = employeeInputSchema.safeParse({
    employeeNumber: formData.get("employeeNumber"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") ?? "",
    lastName: formData.get("lastName"),
    preferredName: formData.get("preferredName") ?? "",
    dateOfHire: formData.get("dateOfHire"),
    positionId: formData.get("positionId") || null,
    departmentId: formData.get("departmentId") || null,
    employmentStatus: formData.get("employmentStatus") || "active",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const input = parsed.data;

  let employeeId: string;
  try {
    employeeId = await withUserContext(ctx.userId, async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO employees (
           organization_id, employee_number, first_name, middle_name, last_name,
           preferred_name, date_of_hire, position_id, department_id, employment_status,
           phone, email, notes, created_by, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
         RETURNING id`,
        [
          ctx.organizationId,
          input.employeeNumber,
          input.firstName,
          input.middleName || null,
          input.lastName,
          input.preferredName || null,
          input.dateOfHire,
          input.positionId ?? null,
          input.departmentId ?? null,
          input.employmentStatus,
          input.phone || null,
          input.email || null,
          input.notes || null,
          ctx.userId,
        ]
      );
      const id = result.rows[0].id;

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "employee.created",
        entityType: "employee",
        entityId: id,
        affectedEmployeeId: id,
        newValue: { employeeNumber: input.employeeNumber, firstName: input.firstName, lastName: input.lastName },
      });

      return id;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create employee.";
    if (message.includes("employees_organization_id_employee_number_key")) {
      return { error: `Employee ID "${input.employeeNumber}" is already in use.` };
    }
    return { error: message };
  }

  redirect(`/employees/${employeeId}`);
}

export async function updateEmployeeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    return { error: "You don't have permission to edit employees." };
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { error: "Missing employee." };

  const parsed = employeeInputSchema.safeParse({
    employeeNumber: formData.get("employeeNumber"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") ?? "",
    lastName: formData.get("lastName"),
    preferredName: formData.get("preferredName") ?? "",
    dateOfHire: formData.get("dateOfHire"),
    positionId: formData.get("positionId") || null,
    departmentId: formData.get("departmentId") || null,
    employmentStatus: formData.get("employmentStatus") || "active",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const input = parsed.data;

  try {
    await withUserContext(ctx.userId, async (client) => {
      const previousResult = await client.query(
        `SELECT employee_number, first_name, middle_name, last_name, preferred_name,
                date_of_hire, position_id, department_id, employment_status, phone, email, notes
         FROM employees WHERE id = $1 AND organization_id = $2`,
        [employeeId, ctx.organizationId]
      );
      const previous = previousResult.rows[0];
      if (!previous) throw new Error("Employee not found.");

      await client.query(
        `UPDATE employees SET
           employee_number = $1, first_name = $2, middle_name = $3, last_name = $4,
           preferred_name = $5, date_of_hire = $6, position_id = $7, department_id = $8,
           employment_status = $9, phone = $10, email = $11, notes = $12, updated_by = $13
         WHERE id = $14 AND organization_id = $15`,
        [
          input.employeeNumber,
          input.firstName,
          input.middleName || null,
          input.lastName,
          input.preferredName || null,
          input.dateOfHire,
          input.positionId ?? null,
          input.departmentId ?? null,
          input.employmentStatus,
          input.phone || null,
          input.email || null,
          input.notes || null,
          ctx.userId,
          employeeId,
          ctx.organizationId,
        ]
      );

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "employee.updated",
        entityType: "employee",
        entityId: employeeId,
        affectedEmployeeId: employeeId,
        previousValue: previous,
        newValue: {
          employee_number: input.employeeNumber,
          first_name: input.firstName,
          middle_name: input.middleName || null,
          last_name: input.lastName,
          preferred_name: input.preferredName || null,
          date_of_hire: input.dateOfHire,
          position_id: input.positionId ?? null,
          department_id: input.departmentId ?? null,
          employment_status: input.employmentStatus,
          phone: input.phone || null,
          email: input.email || null,
          notes: input.notes || null,
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update employee.";
    if (message.includes("employees_organization_id_employee_number_key")) {
      return { error: `Employee ID "${input.employeeNumber}" is already in use.` };
    }
    return { error: message };
  }

  redirect(`/employees/${employeeId}`);
}
