import {
  calculateEmployeeCompliance,
  DEFAULT_COMPLIANCE_THRESHOLDS,
  type ComplianceThresholds,
  type RequirementInput,
} from "@compliance/shared";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

export async function getEmployeeDetail(supabase: SupabaseServerClient, organizationId: string, employeeId: string) {
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select(
      "id, employee_number, first_name, middle_name, last_name, preferred_name, date_of_hire, employment_status, phone, email, notes, position_id, department_id, positions(id, name), departments(id, name)"
    )
    .eq("organization_id", organizationId)
    .eq("id", employeeId)
    .single();

  if (employeeError || !employee) return null;

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

  const positionId = employee.position_id;
  const { data: requirementRows } = positionId
    ? await supabase
        .from("position_requirements")
        .select("is_required, credential_type_id, credential_types(id, name, is_active, requires_document, warning_yellow_threshold_days, warning_orange_threshold_days)")
        .eq("organization_id", organizationId)
        .eq("position_id", positionId)
    : { data: [] as never[] };

  const { data: activeCredentials } = await supabase
    .from("employee_credentials")
    .select("id, credential_type_id, completion_date, expiration_date, certificate_number, issuing_organization, notes")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("status", "active");

  const activeByType = new Map((activeCredentials ?? []).map((c) => [c.credential_type_id, c]));

  const requirements: RequirementInput[] = [];
  const credentials: EmployeeDetailCredential[] = [];

  for (const row of requirementRows ?? []) {
    const credentialType = row.credential_types as unknown as {
      id: string;
      name: string;
      is_active: boolean;
      requires_document: boolean;
      warning_yellow_threshold_days: number | null;
      warning_orange_threshold_days: number | null;
    } | null;
    if (!credentialType || !credentialType.is_active) continue;

    requirements.push({
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

    const active = activeByType.get(row.credential_type_id);
    credentials.push({
      credentialTypeId: row.credential_type_id,
      credentialTypeName: credentialType.name,
      isRequired: row.is_required,
      requiresDocument: credentialType.requires_document,
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

  const position = employee.positions as unknown as { id: string; name: string } | null;
  const department = employee.departments as unknown as { id: string; name: string } | null;

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      middleName: employee.middle_name,
      lastName: employee.last_name,
      preferredName: employee.preferred_name,
      dateOfHire: employee.date_of_hire,
      employmentStatus: employee.employment_status,
      phone: employee.phone,
      email: employee.email,
      notes: employee.notes,
      positionName: position?.name ?? null,
      departmentName: department?.name ?? null,
    },
    credentials,
    compliance,
  };
}
