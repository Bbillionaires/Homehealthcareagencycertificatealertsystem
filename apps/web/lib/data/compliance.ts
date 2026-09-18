import {
  calculateEmployeeCompliance,
  DEFAULT_COMPLIANCE_THRESHOLDS,
  type ComplianceThresholds,
  type EmployeeComplianceResult,
  type RequirementInput,
} from "@compliance/shared";
import type { PoolClient } from "pg";
import { withUserContext } from "@/lib/db/context";

export interface EmployeeWithCompliance {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfHire: string;
  employmentStatus: string;
  positionId: string | null;
  positionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  compliance: EmployeeComplianceResult;
}

/**
 * Loads every active/on-leave employee in the org plus their compliance
 * roll-up. Terminated and inactive employees are excluded by default (they
 * still exist for historical search, just not in active compliance views).
 */
export async function getOrgComplianceRoster(
  userId: string,
  organizationId: string,
  options: { includeInactive?: boolean } = {}
): Promise<EmployeeWithCompliance[]> {
  return withUserContext(userId, (client) => loadRoster(client, organizationId, options));
}

async function loadRoster(
  client: PoolClient,
  organizationId: string,
  options: { includeInactive?: boolean }
): Promise<EmployeeWithCompliance[]> {
  const thresholds = await loadThresholds(client, organizationId);

  const employeeResult = await client.query<{
    id: string;
    employee_number: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    date_of_hire: string;
    employment_status: string;
    position_id: string | null;
    position_name: string | null;
    department_id: string | null;
    department_name: string | null;
  }>(
    `SELECT e.id, e.employee_number, e.first_name, e.last_name, e.preferred_name,
            e.date_of_hire, e.employment_status, e.position_id,
            p.name AS position_name, e.department_id, d.name AS department_name
     FROM employees e
     LEFT JOIN positions p ON p.id = e.position_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.organization_id = $1
       AND ($2::boolean OR e.employment_status IN ('active', 'leave'))
     ORDER BY e.last_name ASC`,
    [organizationId, options.includeInactive ?? false]
  );

  if (employeeResult.rows.length === 0) return [];

  const employeeIds = employeeResult.rows.map((e) => e.id);

  const requirementsByPosition = await loadRequirementsByPosition(client, organizationId);
  const credentialsByEmployee = await loadActiveCredentialsByEmployee(client, organizationId, employeeIds);

  return employeeResult.rows.map((employee) => {
    const requirements = employee.position_id ? requirementsByPosition.get(employee.position_id) ?? [] : [];
    const records = credentialsByEmployee.get(employee.id) ?? [];
    const compliance = calculateEmployeeCompliance(requirements, records, thresholds);

    return {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      lastName: employee.last_name,
      preferredName: employee.preferred_name,
      dateOfHire: employee.date_of_hire,
      employmentStatus: employee.employment_status,
      positionId: employee.position_id,
      positionName: employee.position_name,
      departmentId: employee.department_id,
      departmentName: employee.department_name,
      compliance,
    };
  });
}

async function loadThresholds(client: PoolClient, organizationId: string): Promise<ComplianceThresholds> {
  const result = await client.query<{
    compliance_yellow_threshold_days: number;
    compliance_orange_threshold_days: number;
  }>("SELECT compliance_yellow_threshold_days, compliance_orange_threshold_days FROM organization_settings WHERE organization_id = $1", [
    organizationId,
  ]);
  const row = result.rows[0];
  return row
    ? { yellowThresholdDays: row.compliance_yellow_threshold_days, orangeThresholdDays: row.compliance_orange_threshold_days }
    : DEFAULT_COMPLIANCE_THRESHOLDS;
}

async function loadRequirementsByPosition(
  client: PoolClient,
  organizationId: string
): Promise<Map<string, RequirementInput[]>> {
  const result = await client.query<{
    position_id: string;
    is_required: boolean;
    credential_type_id: string;
    credential_type_name: string;
    warning_yellow_threshold_days: number | null;
    warning_orange_threshold_days: number | null;
  }>(
    `SELECT pr.position_id, pr.is_required, pr.credential_type_id,
            ct.name AS credential_type_name, ct.warning_yellow_threshold_days, ct.warning_orange_threshold_days
     FROM position_requirements pr
     JOIN credential_types ct ON ct.id = pr.credential_type_id
     WHERE pr.organization_id = $1 AND ct.is_active`,
    [organizationId]
  );

  const map = new Map<string, RequirementInput[]>();
  for (const row of result.rows) {
    const list = map.get(row.position_id) ?? [];
    list.push({
      credentialTypeId: row.credential_type_id,
      credentialTypeName: row.credential_type_name,
      isRequired: row.is_required,
      thresholds:
        row.warning_yellow_threshold_days != null || row.warning_orange_threshold_days != null
          ? {
              yellowThresholdDays: row.warning_yellow_threshold_days ?? undefined,
              orangeThresholdDays: row.warning_orange_threshold_days ?? undefined,
            }
          : undefined,
    });
    map.set(row.position_id, list);
  }
  return map;
}

async function loadActiveCredentialsByEmployee(
  client: PoolClient,
  organizationId: string,
  employeeIds: string[]
): Promise<Map<string, { credentialTypeId: string; completionDate: string | null; expirationDate: string | null }[]>> {
  const result = await client.query<{
    employee_id: string;
    credential_type_id: string;
    completion_date: string | null;
    expiration_date: string | null;
  }>(
    `SELECT employee_id, credential_type_id, completion_date, expiration_date
     FROM employee_credentials
     WHERE organization_id = $1 AND status = 'active' AND employee_id = ANY($2::uuid[])`,
    [organizationId, employeeIds]
  );

  const map = new Map<string, { credentialTypeId: string; completionDate: string | null; expirationDate: string | null }[]>();
  for (const row of result.rows) {
    const list = map.get(row.employee_id) ?? [];
    list.push({
      credentialTypeId: row.credential_type_id,
      completionDate: row.completion_date,
      expirationDate: row.expiration_date,
    });
    map.set(row.employee_id, list);
  }
  return map;
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
