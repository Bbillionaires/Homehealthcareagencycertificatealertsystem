import { describe, expect, it } from "vitest";
import { calculateCredentialStatus, calculateEmployeeCompliance } from "../compliance";
import { DEFAULT_COMPLIANCE_THRESHOLDS } from "../types";
import type { CredentialRecordInput, RequirementInput } from "../types";

const TODAY = "2026-09-18";

describe("calculateCredentialStatus", () => {
  it("returns MISSING when there is no record for a required credential", () => {
    const result = calculateCredentialStatus(null, "ct-1", "CPR", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("MISSING");
    expect(result.color).toBe("gray");
  });

  it("returns EXPIRED for a past expiration date", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2025-09-08",
      expirationDate: "2026-09-08", // 10 days before TODAY
    };
    const result = calculateCredentialStatus(record, "ct-1", "HIPAA", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("EXPIRED");
    expect(result.color).toBe("red");
    expect(result.daysRemaining).toBe(-10);
  });

  it("treats the expiration day itself as EXPIRED, not current", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2024-09-18",
      expirationDate: TODAY,
    };
    const result = calculateCredentialStatus(record, "ct-1", "HIPAA", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("EXPIRED");
  });

  it("returns URGENT (orange) within the configured urgent window", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2024-10-18",
      expirationDate: "2026-10-18", // 30 days out
    };
    const result = calculateCredentialStatus(record, "ct-1", "CPR", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("URGENT");
    expect(result.color).toBe("orange");
  });

  it("returns EXPIRING_SOON (yellow) within the configured warning window", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2025-12-02",
      expirationDate: "2026-12-02", // 75 days out
    };
    const result = calculateCredentialStatus(record, "ct-1", "HIPAA", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("EXPIRING_SOON");
    expect(result.color).toBe("yellow");
  });

  it("returns CURRENT (green) well outside the warning window", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2025-06-01",
      expirationDate: "2027-06-01",
    };
    const result = calculateCredentialStatus(record, "ct-1", "CPR", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("CURRENT");
    expect(result.color).toBe("green");
  });

  it("treats a completed credential with no expiration as permanently CURRENT", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2024-01-05",
      expirationDate: null,
    };
    const result = calculateCredentialStatus(record, "ct-1", "Letter of Moral Character", true, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.status).toBe("CURRENT");
  });

  it("respects a per-credential-type threshold override", () => {
    const record: CredentialRecordInput = {
      credentialTypeId: "ct-1",
      completionDate: "2026-06-01",
      expirationDate: "2026-12-01", // 74 days out
    };
    const tight = { yellowThresholdDays: 30, orangeThresholdDays: 10 };
    const result = calculateCredentialStatus(record, "ct-1", "CPR", true, tight, TODAY);
    // 74 days remaining is CURRENT under a 30-day warning window, though it
    // would be EXPIRING_SOON under the org default of 90.
    expect(result.status).toBe("CURRENT");
  });
});

describe("calculateEmployeeCompliance", () => {
  const requirements: RequirementInput[] = [
    { credentialTypeId: "cpr", credentialTypeName: "CPR", isRequired: true },
    { credentialTypeId: "hipaa", credentialTypeName: "HIPAA", isRequired: true },
    { credentialTypeId: "zero_tolerance", credentialTypeName: "Zero Tolerance", isRequired: true },
  ];

  it("is fully compliant with 100% when every requirement is current", () => {
    const records: CredentialRecordInput[] = [
      { credentialTypeId: "cpr", completionDate: "2025-06-01", expirationDate: "2027-06-01" },
      { credentialTypeId: "hipaa", completionDate: "2026-03-01", expirationDate: "2027-03-01" },
      { credentialTypeId: "zero_tolerance", completionDate: "2024-01-15", expirationDate: "2027-01-15" },
    ];
    const result = calculateEmployeeCompliance(requirements, records, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.overallStatus).toBe("CURRENT");
    expect(result.completionPercentage).toBe(100);
    expect(result.reasons).toHaveLength(0);
  });

  it("an expired mandatory credential makes the employee non-compliant regardless of completion percentage", () => {
    const records: CredentialRecordInput[] = [
      { credentialTypeId: "cpr", completionDate: "2025-06-01", expirationDate: "2027-06-01" },
      { credentialTypeId: "hipaa", completionDate: "2025-09-08", expirationDate: "2026-09-08" }, // expired
      { credentialTypeId: "zero_tolerance", completionDate: "2024-01-15", expirationDate: "2027-01-15" },
    ];
    const result = calculateEmployeeCompliance(requirements, records, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    // 2 of 3 current = 67%, but the employee must still read as non-compliant.
    expect(result.completionPercentage).toBe(67);
    expect(result.overallStatus).toBe("EXPIRED");
    expect(result.color).toBe("red");
    expect(result.reasons[0]).toBe("HIPAA expired September 8, 2026.");
  });

  it("uses the worst status among required items (missing outranks urgent)", () => {
    const records: CredentialRecordInput[] = [
      { credentialTypeId: "cpr", completionDate: "2024-10-18", expirationDate: "2026-10-18" }, // urgent, 30 days
      { credentialTypeId: "zero_tolerance", completionDate: "2024-01-15", expirationDate: "2027-01-15" },
      // hipaa has no record at all -> MISSING
    ];
    const result = calculateEmployeeCompliance(requirements, records, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.overallStatus).toBe("MISSING");
  });

  it("ignores non-required requirements when computing the overall status", () => {
    const withOptional: RequirementInput[] = [
      ...requirements,
      { credentialTypeId: "optional_training", credentialTypeName: "Optional Training", isRequired: false },
    ];
    const records: CredentialRecordInput[] = [
      { credentialTypeId: "cpr", completionDate: "2025-06-01", expirationDate: "2027-06-01" },
      { credentialTypeId: "hipaa", completionDate: "2026-03-01", expirationDate: "2027-03-01" },
      { credentialTypeId: "zero_tolerance", completionDate: "2024-01-15", expirationDate: "2027-01-15" },
      // optional_training has no record, but it isn't required.
    ];
    const result = calculateEmployeeCompliance(withOptional, records, DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.overallStatus).toBe("CURRENT");
    expect(result.completionPercentage).toBe(100);
  });

  it("is vacuously compliant when an employee's position has no requirements", () => {
    const result = calculateEmployeeCompliance([], [], DEFAULT_COMPLIANCE_THRESHOLDS, TODAY);
    expect(result.overallStatus).toBe("CURRENT");
    expect(result.completionPercentage).toBe(100);
  });
});
