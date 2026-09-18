import type { PoolClient } from "pg";
import {
  calculateCredentialStatus,
  DEFAULT_COMPLIANCE_THRESHOLDS,
  DEFAULT_NOTIFY_SCHEDULE_DAYS,
  isNotificationMilestoneDay,
  notificationDedupeKey,
  todayIso,
  type ComplianceThresholds,
} from "@compliance/shared";
import { jobPool } from "@/lib/db/jobPool";
import { createNotification } from "./dispatch";
import {
  expirationWarningEmail,
  urgentExpirationEmail,
  expiredCredentialEmail,
  missingDocumentationEmail,
} from "./templates";

export interface NightlyCheckSummary {
  organizationsProcessed: number;
  notificationsCreated: number;
}

/**
 * The daily compliance/expiration check (§7/§12 of the brief): for
 * every organization's active roster, evaluates each required
 * credential through the exact same shared engine the dashboard and
 * reports use, and creates a notification for every credential that
 * hits a configured milestone day, stays overdue, or is missing
 * entirely. Idempotent by design -- every insert is deduped in
 * createNotification, so running this multiple times (or re-running
 * after a crash) never double-sends.
 */
export async function runNightlyNotificationCheck(): Promise<NightlyCheckSummary> {
  const client = await jobPool.connect();
  try {
    const orgsResult = await client.query<{ id: string }>("SELECT id FROM organizations");

    let notificationsCreated = 0;
    for (const org of orgsResult.rows) {
      notificationsCreated += await processOrganization(client, org.id);
    }

    return { organizationsProcessed: orgsResult.rows.length, notificationsCreated };
  } finally {
    client.release();
  }
}

async function processOrganization(client: PoolClient, organizationId: string): Promise<number> {
  const settingsResult = await client.query<{
    compliance_yellow_threshold_days: number;
    compliance_orange_threshold_days: number;
    notify_schedule_days: number[];
  }>(
    "SELECT compliance_yellow_threshold_days, compliance_orange_threshold_days, notify_schedule_days FROM organization_settings WHERE organization_id = $1",
    [organizationId]
  );
  const settings = settingsResult.rows[0];
  const thresholds: ComplianceThresholds = settings
    ? { yellowThresholdDays: settings.compliance_yellow_threshold_days, orangeThresholdDays: settings.compliance_orange_threshold_days }
    : DEFAULT_COMPLIANCE_THRESHOLDS;
  const scheduleDays = settings?.notify_schedule_days ?? DEFAULT_NOTIFY_SCHEDULE_DAYS;

  const adminsResult = await client.query<{ user_id: string; email: string }>(
    `SELECT ou.user_id, u.email
     FROM organization_users ou
     JOIN roles r ON r.id = ou.role_id
     JOIN users u ON u.id = ou.user_id
     WHERE ou.organization_id = $1 AND ou.is_active AND r.key IN ('owner', 'office_manager')`,
    [organizationId]
  );

  const employeeUsersResult = await client.query<{ employee_id: string; user_id: string; email: string }>(
    `SELECT ou.employee_id, ou.user_id, u.email
     FROM organization_users ou
     JOIN users u ON u.id = ou.user_id
     WHERE ou.organization_id = $1 AND ou.is_active AND ou.employee_id IS NOT NULL`,
    [organizationId]
  );
  const userByEmployeeId = new Map(employeeUsersResult.rows.map((r) => [r.employee_id, { userId: r.user_id, email: r.email }]));

  const employeesResult = await client.query<{ id: string; first_name: string; last_name: string; position_id: string | null }>(
    `SELECT id, first_name, last_name, position_id FROM employees
     WHERE organization_id = $1 AND employment_status IN ('active', 'leave')`,
    [organizationId]
  );
  if (employeesResult.rows.length === 0) return 0;

  const requirementsResult = await client.query<{
    position_id: string;
    credential_type_id: string;
    credential_type_name: string;
  }>(
    `SELECT pr.position_id, pr.credential_type_id, ct.name AS credential_type_name
     FROM position_requirements pr
     JOIN credential_types ct ON ct.id = pr.credential_type_id
     WHERE pr.organization_id = $1 AND pr.is_required AND ct.is_active`,
    [organizationId]
  );
  const requirementsByPosition = new Map<string, { credentialTypeId: string; credentialTypeName: string }[]>();
  for (const row of requirementsResult.rows) {
    const list = requirementsByPosition.get(row.position_id) ?? [];
    list.push({ credentialTypeId: row.credential_type_id, credentialTypeName: row.credential_type_name });
    requirementsByPosition.set(row.position_id, list);
  }

  const employeeIds = employeesResult.rows.map((e) => e.id);
  const credentialsResult = await client.query<{
    id: string;
    employee_id: string;
    credential_type_id: string;
    completion_date: string | null;
    expiration_date: string | null;
  }>(
    `SELECT id, employee_id, credential_type_id, completion_date, expiration_date
     FROM employee_credentials
     WHERE organization_id = $1 AND status = 'active' AND employee_id = ANY($2::uuid[])`,
    [organizationId, employeeIds]
  );
  const credentialByEmployeeAndType = new Map(
    credentialsResult.rows.map((r) => [`${r.employee_id}:${r.credential_type_id}`, r])
  );

  const today = todayIso();
  let created = 0;

  for (const employee of employeesResult.rows) {
    if (!employee.position_id) continue;
    const requirements = requirementsByPosition.get(employee.position_id) ?? [];
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    for (const requirement of requirements) {
      const record = credentialByEmployeeAndType.get(`${employee.id}:${requirement.credentialTypeId}`);
      const status = calculateCredentialStatus(
        record ? { credentialTypeId: requirement.credentialTypeId, completionDate: record.completion_date, expirationDate: record.expiration_date } : null,
        requirement.credentialTypeId,
        requirement.credentialTypeName,
        true,
        thresholds,
        today
      );

      if (status.status === "MISSING") {
        created += await notifyMissing(client, organizationId, employee.id, employeeName, requirement, adminsResult.rows, userByEmployeeId);
        continue;
      }

      if (status.daysRemaining === null || !record) continue;
      if (!isNotificationMilestoneDay(status.daysRemaining, scheduleDays)) continue;

      created += await notifyExpiration(
        client,
        organizationId,
        employee.id,
        record.id,
        employeeName,
        requirement.credentialTypeName,
        status.expirationDate!,
        status.daysRemaining,
        adminsResult.rows,
        userByEmployeeId.get(employee.id)
      );
    }
  }

  return created;
}

async function notifyMissing(
  client: PoolClient,
  organizationId: string,
  employeeId: string,
  employeeName: string,
  requirement: { credentialTypeId: string; credentialTypeName: string },
  admins: { user_id: string; email: string }[],
  userByEmployeeId: Map<string, { userId: string; email: string }>
): Promise<number> {
  const email = missingDocumentationEmail({ employeeName, credentialName: requirement.credentialTypeName });
  const dedupeKey = `employee:${employeeId}:credential_type:${requirement.credentialTypeId}:missing`;
  let created = 0;

  for (const admin of admins) {
    const wasCreated = await createNotification(client, {
      organizationId,
      recipientUserId: admin.user_id,
      recipientEmail: admin.email,
      employeeId,
      type: "missing_documentation",
      severity: "warning",
      dedupeKey: `${dedupeKey}:${admin.user_id}`,
      email,
    });
    if (wasCreated) created += 1;
  }

  const self = userByEmployeeId.get(employeeId);
  if (self) {
    const wasCreated = await createNotification(client, {
      organizationId,
      recipientUserId: self.userId,
      recipientEmail: self.email,
      employeeId,
      type: "missing_documentation",
      severity: "warning",
      dedupeKey: `${dedupeKey}:${self.userId}`,
      email,
    });
    if (wasCreated) created += 1;
  }

  return created;
}

async function notifyExpiration(
  client: PoolClient,
  organizationId: string,
  employeeId: string,
  employeeCredentialId: string,
  employeeName: string,
  credentialName: string,
  expirationDate: string,
  daysRemaining: number,
  admins: { user_id: string; email: string }[],
  self: { userId: string; email: string } | undefined
): Promise<number> {
  const email =
    daysRemaining <= 0
      ? expiredCredentialEmail({ employeeName, credentialName, expirationDate })
      : daysRemaining <= 14
        ? urgentExpirationEmail({ employeeName, credentialName, expirationDate, daysRemaining })
        : expirationWarningEmail({ employeeName, credentialName, expirationDate, daysRemaining });

  const type = daysRemaining <= 0 ? "expired" : daysRemaining <= 14 ? "urgent_expiration" : "expiration_warning";
  const severity = daysRemaining <= 0 ? "critical" : daysRemaining <= 14 ? "urgent" : "warning";
  const dedupeKey = notificationDedupeKey(employeeCredentialId, daysRemaining);

  let created = 0;
  const recipients = [...admins.map((a) => ({ userId: a.user_id, email: a.email })), ...(self ? [self] : [])];

  for (const recipient of recipients) {
    const wasCreated = await createNotification(client, {
      organizationId,
      recipientUserId: recipient.userId,
      recipientEmail: recipient.email,
      employeeId,
      employeeCredentialId,
      type,
      severity,
      dedupeKey: `${dedupeKey}:${recipient.userId}`,
      email,
    });
    if (wasCreated) created += 1;
  }

  return created;
}
