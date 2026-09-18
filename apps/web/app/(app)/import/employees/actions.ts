"use server";

import { parseEmployeeImportCsv } from "@compliance/shared";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";
import { recordAuditLog } from "@/lib/audit";

export interface ImportResult {
  error?: string;
  imported?: number;
  skipped?: { rowNumber: number; errors: string[] }[];
}

/**
 * Re-parses and re-validates the CSV server-side rather than trusting
 * anything the client computed (including any position/department IDs
 * it resolved for preview) -- the client's copy of positions/
 * departments/existing employee numbers can be stale, and a tampered
 * request could otherwise smuggle in an ID from another organization.
 */
export async function importEmployeesAction(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    return { error: "You don't have permission to import employees." };
  }

  const csvText = String(formData.get("csvText") ?? "");
  if (!csvText.trim()) {
    return { error: "No file content received." };
  }

  return withUserContext(ctx.userId, async (client) => {
    const [positionsResult, departmentsResult, employeesResult] = await Promise.all([
      client.query<{ id: string; name: string }>("SELECT id, name FROM positions WHERE organization_id = $1", [
        ctx.organizationId,
      ]),
      client.query<{ id: string; name: string }>("SELECT id, name FROM departments WHERE organization_id = $1", [
        ctx.organizationId,
      ]),
      client.query<{ employee_number: string }>("SELECT employee_number FROM employees WHERE organization_id = $1", [
        ctx.organizationId,
      ]),
    ]);

    const { headerErrors, rows } = parseEmployeeImportCsv(csvText, {
      existingEmployeeNumbers: new Set(employeesResult.rows.map((e) => e.employee_number.toLowerCase())),
      positionNamesToId: new Map(positionsResult.rows.map((p) => [p.name.toLowerCase(), p.id])),
      departmentNamesToId: new Map(departmentsResult.rows.map((d) => [d.name.toLowerCase(), d.id])),
    });

    if (headerErrors.length > 0) {
      return { error: headerErrors[0] };
    }

    let imported = 0;
    const skipped: { rowNumber: number; errors: string[] }[] = [];
    const importedNumbers: string[] = [];

    for (const row of rows) {
      if (!row.resolved) {
        skipped.push({ rowNumber: row.rowNumber, errors: row.errors });
        continue;
      }

      const r = row.resolved;
      try {
        await client.query(
          `INSERT INTO employees (
             organization_id, employee_number, first_name, middle_name, last_name,
             preferred_name, date_of_hire, position_id, department_id, employment_status,
             phone, email, notes, created_by, updated_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
          [
            ctx.organizationId,
            r.employeeNumber,
            r.firstName,
            r.middleName,
            r.lastName,
            r.preferredName,
            r.dateOfHire,
            r.positionId,
            r.departmentId,
            r.employmentStatus,
            r.phone,
            r.email,
            r.notes,
            ctx.userId,
          ]
        );
        imported += 1;
        importedNumbers.push(r.employeeNumber);
      } catch (err) {
        skipped.push({
          rowNumber: row.rowNumber,
          errors: [err instanceof Error ? err.message : "Failed to insert this row."],
        });
      }
    }

    if (imported > 0) {
      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "employee.imported",
        entityType: "employee",
        metadata: { imported, skipped: skipped.length, employeeNumbers: importedNumbers },
      });
    }

    return { imported, skipped };
  });
}
