import {
  calculateEmployeeCompliance,
  DEFAULT_COMPLIANCE_THRESHOLDS,
  type ComplianceThresholds,
  type EmployeeComplianceResult,
  type RequirementInput,
} from "@compliance/shared";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface EmployeeWithCompliance {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfHire: string;
  employmentStatus: string;
  positionName: string | null;
  departmentName: string | null;
  compliance: EmployeeComplianceResult;
}

/**
 * Loads every active/on-leave employee in the org plus their compliance
 * roll-up. Terminated and inactive employees are excluded by default (they
 * still exist for historical search, just not in active compliance views).
 */
export async function getOrgComplianceRoster(
  supabase: SupabaseServerClient,
  organizationId: string,
  options: { includeInactive?: boolean } = {}
): Promise<EmployeeWithCompliance[]> {
  const { data: settings } = await supabase
    .from("organization_settings")
    .select("compliance_yellow_threshold_days, compliance_orange_threshold_days")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const thresholds: ComplianceThresholds = settings
    ? {
        yellowThresholdDays: settings.compliance_yellow_threshold_days,
        orangeThresholdDays: settings.compliance_orange_threshold_days,
      }
    : DEFAULT_COMPLIANCE_THRESHOLDS;

  let employeeQuery = supabase
    .from("employees")
    .select("id, employee_number, first_name, last_name, preferred_name, date_of_hire, employment_status, position_id, positions(name), departments(name)")
    .eq("organization_id", organizationId)
    .order("last_name", { ascending: true });

  if (!options.includeInactive) {
    employeeQuery = employeeQuery.in("employment_status", ["active", "leave"]);
  }

  const { data: employees, error: employeesError } = await employeeQuery;
  if (employeesError) throw new Error(employeesError.message);
  if (!employees || employees.length === 0) return [];

  const employeeIds = employees.map((e) => e.id);

  const { data: requirementRows, error: reqError } = await supabase
    .from("position_requirements")
    .select("position_id, is_required, credential_type_id, credential_types(id, name, is_active, warning_yellow_threshold_days, warning_orange_threshold_days)")
    .eq("organization_id", organizationId);
  if (reqError) throw new Error(reqError.message);

  const requirementsByPosition = new Map<string, RequirementInput[]>();
  for (const row of requirementRows ?? []) {
    const credentialType = row.credential_types as unknown as {
      id: string;
      name: string;
      is_active: boolean;
      warning_yellow_threshold_days: number | null;
      warning_orange_threshold_days: number | null;
    } | null;
    if (!credentialType || !credentialType.is_active || !row.position_id) continue;

    const list = requirementsByPosition.get(row.position_id) ?? [];
    list.push({
      credentialTypeId: row.credential_type_id,
      credentialTypeName: credentialType.name,
      isRequired: row.is_required,
      thresholds:
        credentialType.warning_yellow_threshold_days != null || credentialType.warning_orange_threshold_days != null
          ? {
              yellowThresholdDays: credentialType.warning_yellow_threshold_days ?? undefined,
              orangeThresholdDays: credentialType.warning_orange_threshold_days ?? undefined,
            }
          : undefined,
    });
    requirementsByPosition.set(row.position_id, list);
  }

  const { data: credentialRows, error: credError } = await supabase
    .from("employee_credentials")
    .select("employee_id, credential_type_id, completion_date, expiration_date")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("employee_id", employeeIds);
  if (credError) throw new Error(credError.message);

  const credentialsByEmployee = new Map<string, { credentialTypeId: string; completionDate: string | null; expirationDate: string | null }[]>();
  for (const row of credentialRows ?? []) {
    const list = credentialsByEmployee.get(row.employee_id) ?? [];
    list.push({
      credentialTypeId: row.credential_type_id,
      completionDate: row.completion_date,
      expirationDate: row.expiration_date,
    });
    credentialsByEmployee.set(row.employee_id, list);
  }

  return employees.map((employee) => {
    const requirements = employee.position_id ? requirementsByPosition.get(employee.position_id) ?? [] : [];
    const records = credentialsByEmployee.get(employee.id) ?? [];
    const compliance = calculateEmployeeCompliance(requirements, records, thresholds);

    const position = employee.positions as unknown as { name: string } | null;
    const department = employee.departments as unknown as { name: string } | null;

    return {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      lastName: employee.last_name,
      preferredName: employee.preferred_name,
      dateOfHire: employee.date_of_hire,
      employmentStatus: employee.employment_status,
      positionName: position?.name ?? null,
      departmentName: department?.name ?? null,
      compliance,
    };
  });
}

export interface DashboardCounts {
  total: number;
  compliant: number;
  expiringSoon: number;
  urgent: number;
  expired: number;
  missingDocumentation: number;
}

export function summarizeRoster(roster: EmployeeWithCompliance[]): DashboardCounts {
  const counts: DashboardCounts = {
    total: roster.length,
    compliant: 0,
    expiringSoon: 0,
    urgent: 0,
    expired: 0,
    missingDocumentation: 0,
  };

  for (const employee of roster) {
    switch (employee.compliance.overallStatus) {
      case "CURRENT":
        counts.compliant += 1;
        break;
      case "EXPIRING_SOON":
        counts.expiringSoon += 1;
        break;
      case "URGENT":
        counts.urgent += 1;
        break;
      case "EXPIRED":
        counts.expired += 1;
        break;
      case "MISSING":
        counts.missingDocumentation += 1;
        break;
    }
  }

  return counts;
}
