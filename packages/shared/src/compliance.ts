import { daysBetween, formatDateLong, todayIso } from "./dates";
import {
  CREDENTIAL_STATUS_SEVERITY,
  STATUS_PRESENTATION,
  DEFAULT_COMPLIANCE_THRESHOLDS,
  type ComplianceThresholds,
  type CredentialRecordInput,
  type CredentialStatusKey,
  type CredentialStatusResult,
  type EmployeeComplianceResult,
  type RequirementInput,
} from "./types";

/**
 * The single source of truth for turning a completion/expiration date pair
 * into a compliance status. Used identically by the web app, the mobile
 * app, the nightly notification job, and report generation — never
 * reimplemented per surface.
 */
export function calculateCredentialStatus(
  record: CredentialRecordInput | null,
  credentialTypeId: string,
  credentialTypeName: string,
  isRequired: boolean,
  thresholds: ComplianceThresholds = DEFAULT_COMPLIANCE_THRESHOLDS,
  referenceDate: string = todayIso()
): CredentialStatusResult {
  const base = { credentialTypeId, credentialTypeName, isRequired };

  if (!record || !record.completionDate) {
    return {
      ...base,
      ...STATUS_PRESENTATION.MISSING,
      daysRemaining: null,
      expirationDate: null,
    };
  }

  if (!record.expirationDate) {
    // Completed, never-expiring credential type (e.g. a one-time document).
    return {
      ...base,
      ...STATUS_PRESENTATION.CURRENT,
      daysRemaining: null,
      expirationDate: null,
    };
  }

  const daysRemaining = daysBetween(referenceDate, record.expirationDate);
  const status = statusFromDaysRemaining(daysRemaining, thresholds);

  return {
    ...base,
    ...STATUS_PRESENTATION[status],
    daysRemaining,
    expirationDate: record.expirationDate,
  };
}

function statusFromDaysRemaining(
  daysRemaining: number,
  thresholds: ComplianceThresholds
): CredentialStatusKey {
  if (daysRemaining <= 0) return "EXPIRED";
  if (daysRemaining <= thresholds.orangeThresholdDays) return "URGENT";
  if (daysRemaining <= thresholds.yellowThresholdDays) return "EXPIRING_SOON";
  return "CURRENT";
}

/**
 * Rolls up every required credential for one employee into a single
 * overall status. The most serious outstanding *mandatory* requirement
 * controls the result — a high completion percentage can never mask an
 * expired or missing mandatory credential.
 */
export function calculateEmployeeCompliance(
  requirements: RequirementInput[],
  records: CredentialRecordInput[],
  orgThresholds: ComplianceThresholds = DEFAULT_COMPLIANCE_THRESHOLDS,
  referenceDate: string = todayIso()
): EmployeeComplianceResult {
  const recordByType = new Map(records.map((r) => [r.credentialTypeId, r]));

  const results = requirements.map((req) => {
    const thresholds: ComplianceThresholds = {
      yellowThresholdDays: req.thresholds?.yellowThresholdDays ?? orgThresholds.yellowThresholdDays,
      orangeThresholdDays: req.thresholds?.orangeThresholdDays ?? orgThresholds.orangeThresholdDays,
    };
    return calculateCredentialStatus(
      recordByType.get(req.credentialTypeId) ?? null,
      req.credentialTypeId,
      req.credentialTypeName,
      req.isRequired,
      thresholds,
      referenceDate
    );
  });

  const requiredResults = results.filter((r) => r.isRequired);
  const currentCount = requiredResults.filter((r) => r.status === "CURRENT").length;
  const requiredCount = requiredResults.length;
  const completionPercentage = requiredCount === 0 ? 100 : Math.round((currentCount / requiredCount) * 100);

  const overall = requiredResults.reduce<CredentialStatusResult | null>((worst, current) => {
    if (!worst) return current;
    return CREDENTIAL_STATUS_SEVERITY[current.status] > CREDENTIAL_STATUS_SEVERITY[worst.status]
      ? current
      : worst;
  }, null);

  const overallStatus = overall?.status ?? "CURRENT";
  const presentation = STATUS_PRESENTATION[overallStatus];

  const reasons = requiredResults
    .filter((r) => r.status !== "CURRENT")
    .sort((a, b) => CREDENTIAL_STATUS_SEVERITY[b.status] - CREDENTIAL_STATUS_SEVERITY[a.status])
    .map((r) => describeReason(r));

  return {
    overallStatus,
    color: presentation.color,
    icon: presentation.icon,
    label: presentation.label,
    completionPercentage,
    requiredCount,
    currentCount,
    results,
    reasons,
  };
}

function describeReason(result: CredentialStatusResult): string {
  switch (result.status) {
    case "EXPIRED":
      return `${result.credentialTypeName} expired ${formatDateLong(result.expirationDate!)}.`;
    case "URGENT":
      return `${result.credentialTypeName} expires ${formatDateLong(result.expirationDate!)} (${result.daysRemaining} day${result.daysRemaining === 1 ? "" : "s"} remaining).`;
    case "EXPIRING_SOON":
      return `${result.credentialTypeName} expires ${formatDateLong(result.expirationDate!)} (${result.daysRemaining} days remaining).`;
    case "MISSING":
      return `${result.credentialTypeName} is missing.`;
    default:
      return `${result.credentialTypeName} is current.`;
  }
}
