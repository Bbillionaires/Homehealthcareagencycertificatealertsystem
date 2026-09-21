import type { IntervalUnit } from "./dates";

export const CREDENTIAL_STATUSES = [
  "CURRENT",
  "EXPIRING_SOON",
  "URGENT",
  "EXPIRED",
  "MISSING",
] as const;

export type CredentialStatusKey = (typeof CREDENTIAL_STATUSES)[number];

/**
 * Worst-first severity order. Index position is used to pick the "most
 * serious outstanding requirement" when rolling many credentials up into
 * one employee-level status — the higher the index, the worse the status.
 */
export const CREDENTIAL_STATUS_SEVERITY: Record<CredentialStatusKey, number> = {
  CURRENT: 0,
  EXPIRING_SOON: 1,
  URGENT: 2,
  EXPIRED: 3,
  MISSING: 4,
};

export type ComplianceColor = "green" | "yellow" | "orange" | "red" | "gray";

/**
 * An employee's overall roll-up status is either one of the real
 * per-credential statuses above (driven by their worst mandatory
 * credential), or NOT_APPLICABLE when they have zero mandatory
 * requirements to be measured against at all (no position assigned, or a
 * position with no configured requirements). NOT_APPLICABLE must never be
 * presented the same as CURRENT — "nothing to check" is not "verified
 * compliant" — so it's a distinct status with its own gray/neutral
 * presentation, never produced by calculateCredentialStatus itself.
 */
export type OverallStatusKey = CredentialStatusKey | "NOT_APPLICABLE";

export interface StatusPresentation {
  status: CredentialStatusKey;
  color: ComplianceColor;
  /** Name of an icon in the design system; never rely on color alone. */
  icon: "check-circle" | "clock" | "alert-triangle" | "x-circle" | "help-circle";
  label: string;
}

export const STATUS_PRESENTATION: Record<CredentialStatusKey, StatusPresentation> = {
  CURRENT: { status: "CURRENT", color: "green", icon: "check-circle", label: "Current" },
  EXPIRING_SOON: { status: "EXPIRING_SOON", color: "yellow", icon: "clock", label: "Expiring Soon" },
  URGENT: { status: "URGENT", color: "orange", icon: "alert-triangle", label: "Urgent" },
  EXPIRED: { status: "EXPIRED", color: "red", icon: "x-circle", label: "Expired" },
  MISSING: { status: "MISSING", color: "gray", icon: "help-circle", label: "Missing" },
};

export interface OverallStatusPresentation {
  status: OverallStatusKey;
  color: ComplianceColor;
  icon: StatusPresentation["icon"] | "minus-circle";
  label: string;
}

export const NOT_APPLICABLE_PRESENTATION: OverallStatusPresentation = {
  status: "NOT_APPLICABLE",
  color: "gray",
  icon: "minus-circle",
  label: "No Requirements Assigned",
};

export interface ComplianceThresholds {
  /** Above this many days remaining, a credential is CURRENT (green). */
  yellowThresholdDays: number;
  /** Above this (and at/under yellowThresholdDays), a credential is EXPIRING_SOON (yellow). */
  orangeThresholdDays: number;
}

export const DEFAULT_COMPLIANCE_THRESHOLDS: ComplianceThresholds = {
  yellowThresholdDays: 90,
  orangeThresholdDays: 60,
};

export interface CredentialTypeDefinition {
  key: string;
  name: string;
  category: "training" | "background_check" | "document" | "other";
  renewalIntervalValue: number | null;
  renewalIntervalUnit: IntervalUnit | null;
  requiresDocument: boolean;
  sortOrder: number;
}

/** Credential record as needed by the compliance engine — a thin slice of `employee_credentials`. */
export interface CredentialRecordInput {
  credentialTypeId: string;
  completionDate: string | null;
  expirationDate: string | null;
}

export interface RequirementInput {
  credentialTypeId: string;
  credentialTypeName: string;
  isRequired: boolean;
  thresholds?: Partial<ComplianceThresholds>;
}

export interface CredentialStatusResult extends StatusPresentation {
  credentialTypeId: string;
  credentialTypeName: string;
  daysRemaining: number | null;
  expirationDate: string | null;
  isRequired: boolean;
}

export interface EmployeeComplianceResult {
  overallStatus: OverallStatusKey;
  color: ComplianceColor;
  icon: OverallStatusPresentation["icon"];
  label: string;
  completionPercentage: number;
  requiredCount: number;
  currentCount: number;
  results: CredentialStatusResult[];
  /** Human-readable reasons for every non-CURRENT required item, worst first. */
  reasons: string[];
}
