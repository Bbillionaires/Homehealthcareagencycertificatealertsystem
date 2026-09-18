"use server";

import { redirect } from "next/navigation";
import { employeeInputSchema } from "@compliance/shared";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

  const { data: employee, error } = await supabase
    .from("employees")
    .insert({
      organization_id: ctx.organizationId,
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
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !employee) {
    if (error?.code === "23505") {
      return { error: `Employee ID "${input.employeeNumber}" is already in use.` };
    }
    return { error: error?.message ?? "Failed to create employee." };
  }

  await recordAuditLog(supabase, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    affectedEmployeeId: employee.id,
    newValue: { employeeNumber: input.employeeNumber, firstName: input.firstName, lastName: input.lastName },
  });

  redirect(`/employees/${employee.id}`);
}
