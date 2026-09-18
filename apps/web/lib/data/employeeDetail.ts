import {
  calculateEmployeeCompliance,
  DEFAULT_COMPLIANCE_THRESHOLDS,
  type ComplianceThresholds,
  type RequirementInput,
} from "@compliance/shared";
import type { PoolClient } from "pg";
import { withUserContext } from "@/lib/db/context";

export interface EmployeeDetailCredential {
  credentialTypeId: string;
  credentialTypeName: string;
  isRequired: boolean;
  requiresDocument: boolean;
  activeRecordId: string | null;
  completionDate: string | null;
  expirationDate: string | null;
  certificateNumber: string | null;
  issuingOrganization: string | null;
  notes: string | null;
}

export async function getEmployeeDetail(userId: string, organizationId: string, employeeId: string) {
  return withUserContext(userId, (client) => loadEmployeeDetail(client, organizationId, employeeId));
}

async function loadEmployeeDetail(client: PoolClient, organizationId: string, employeeId: string) {
  const employeeResult = await client.query<{
    id: string;
    employee_number: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    preferred_name: string | null;
    date_of_hire: string;
    employment_status: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    position_id: string | null;
    position_name: string | null;
    department_name: string | null;
  }>(
    `SELECT e.id, e.employee_number, e.first_name, e.middle_name, e.last_name, e.preferred_name,
            e.date_of_hire, e.employment_status, e.phone, e.email, e.notes, e.position_id,
            p.name AS position_name, d.name AS department_name
     FROM employees e
     LEFT JOIN positions p ON p.id = e.position_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.organization_id = $1 AND e.id = $2`,
    [organizationId, employeeId]
  );

  const employeeRow = employeeResult.rows[0];
  if (!employeeRow) return null;

  const thresholdsResult = await client.query<{
    compliance_yellow_threshold_days: number;
    compliance_orange_threshold_days: number;
  }>(
    "SELECT compliance_yellow_threshold_days, compliance_orange_threshold_days FROM organization_settings WHERE organization_id = $1",
    [organizationId]
  );
  const thresholds: ComplianceThresholds = thresholdsResult.rows[0]
    ? {
        yellowThresholdDays: thresholdsResult.rows[0].compliance_yellow_threshold_days,
        orangeThresholdDays: thresholdsResult.rows[0].compliance_orange_threshold_days,
      }
    : DEFAULT_COMPLIANCE_THRESHOLDS;

  const requirementResult = employeeRow.position_id
    ? await client.query<{
        is_required: boolean;
        credential_type_id: string;
        credential_type_name: string;
        requires_document: boolean;
        warning_yellow_threshold_days: number | null;
        warning_orange_threshold_days: number | null;
      }>(
        `SELECT pr.is_required, pr.credential_type_id, ct.name AS credential_type_name, ct.requires_document,
                ct.warning_yellow_threshold_days, ct.warning_orange_threshold_days
         FROM position_requirements pr
         JOIN credential_types ct ON ct.id = pr.credential_type_id
         WHERE pr.organization_id = $1 AND pr.position_id = $2 AND ct.is_active`,
        [organizationId, employeeRow.position_id]
      )
    : { rows: [] as never[] };

  const activeResult = await client.query<{
    id: string;
    credential_type_id: string;
    completion_date: string | null;
    expiration_date: string | null;
    certificate_number: string | null;
    issuing_organization: string | null;
    notes: string | null;
  }>(
    `SELECT id, credential_type_id, completion_date, expiration_date, certificate_number, issuing_organization, notes
     FROM employee_credentials
     WHERE organization_id = $1 AND employee_id = $2 AND status = 'active'`,
    [organizationId, employeeId]
  );
  const activeByType = new Map(activeResult.rows.map((row) => [row.credential_type_id, row]));

  const requirements: RequirementInput[] = [];
  const credentials: EmployeeDetailCredential[] = [];

  for (const row of requirementResult.rows) {
    requirements.push({
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

    const active = activeByType.get(row.credential_type_id);
    credentials.push({
      credentialTypeId: row.credential_type_id,
      credentialTypeName: row.credential_type_name,
      isRequired: row.is_required,
      requiresDocument: row.requires_document,
      activeRecordId: active?.id ?? null,
      completionDate: active?.completion_date ?? null,
      expirationDate: active?.expiration_date ?? null,
      certificateNumber: active?.certificate_number ?? null,
      issuingOrganization: active?.issuing_organization ?? null,
      notes: active?.notes ?? null,
    });
  }

  const records = credentials
    .filter((c) => c.completionDate)
    .map((c) => ({
      credentialTypeId: c.credentialTypeId,
      completionDate: c.completionDate,
      expirationDate: c.expirationDate,
    }));

  const compliance = calculateEmployeeCompliance(requirements, records, thresholds);

  return {
    employee: {
      id: employeeRow.id,
      employeeNumber: employeeRow.employee_number,
      firstName: employeeRow.first_name,
      middleName: employeeRow.middle_name,
      lastName: employeeRow.last_name,
      preferredName: employeeRow.preferred_name,
      dateOfHire: employeeRow.date_of_hire,
      employmentStatus: employeeRow.employment_status,
      phone: employeeRow.phone,
      email: employeeRow.email,
      notes: employeeRow.notes,
      positionName: employeeRow.position_name,
      departmentName: employeeRow.department_name,
    },
    credentials,
    compliance,
  };
}
