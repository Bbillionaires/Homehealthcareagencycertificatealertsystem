import { describe, expect, it } from "vitest";
import { parseCsv, parseEmployeeImportCsv } from "../csvImport";

describe("parseCsv", () => {
  it("parses a simple grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('a,"b,with,commas",c\n1,2,3')).toEqual([
      ["a", "b,with,commas", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles doubled-quote escaping inside a quoted field", () => {
    expect(parseCsv('a,"she said ""hi""",c')).toEqual([["a", 'she said "hi"', "c"]]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips fully blank trailing lines", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseEmployeeImportCsv", () => {
  const baseContext = {
    existingEmployeeNumbers: new Set<string>(),
    positionNamesToId: new Map([["direct care worker", "pos-1"]]),
    departmentNamesToId: new Map([["home care services", "dept-1"]]),
  };

  it("reports a header error when required columns are missing", () => {
    const csv = "first_name,last_name\nJane,Smith";
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.headerErrors.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(0);
  });

  it("parses a valid row and resolves position/department by name", () => {
    const csv = [
      "employee_number,first_name,last_name,date_of_hire,position,department",
      "EMP-2001,Jane,Smith,2026-01-15,Direct Care Worker,Home Care Services",
    ].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows).toHaveLength(1);
    const [row] = result.rows;
    expect(row.errors).toHaveLength(0);
    expect(row.resolved).toMatchObject({
      employeeNumber: "EMP-2001",
      firstName: "Jane",
      lastName: "Smith",
      dateOfHire: "2026-01-15",
      positionId: "pos-1",
      departmentId: "dept-1",
      employmentStatus: "active",
    });
  });

  it("flags a row missing required fields", () => {
    const csv = ["employee_number,first_name,last_name,date_of_hire", ",,,"].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    const [row] = result.rows;
    expect(row.errors).toContain("Employee ID is required.");
    expect(row.errors).toContain("First name is required.");
    expect(row.errors).toContain("Last name is required.");
    expect(row.errors).toContain("Date of hire is required.");
    expect(row.resolved).toBeUndefined();
  });

  it("rejects a malformed date", () => {
    const csv = ["employee_number,first_name,last_name,date_of_hire", "EMP-1,Jane,Smith,01/15/2026"].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows[0].errors).toContain("Date of hire must be in YYYY-MM-DD format.");
  });

  it("flags a duplicate against an existing employee number", () => {
    const csv = ["employee_number,first_name,last_name,date_of_hire", "EMP-1001,Jane,Smith,2026-01-15"].join("\n");
    const result = parseEmployeeImportCsv(csv, {
      ...baseContext,
      existingEmployeeNumbers: new Set(["emp-1001"]),
    });
    expect(result.rows[0].errors).toContain('Employee ID "EMP-1001" already exists.');
  });

  it("flags a duplicate within the same file, keeping the first occurrence clean", () => {
    const csv = [
      "employee_number,first_name,last_name,date_of_hire",
      "EMP-1,Jane,Smith,2026-01-15",
      "EMP-1,John,Doe,2026-02-01",
    ].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows[0].errors).toHaveLength(0);
    expect(result.rows[1].errors).toContain('Employee ID "EMP-1" is duplicated earlier in this file.');
  });

  it("flags an unknown position or department by name", () => {
    const csv = [
      "employee_number,first_name,last_name,date_of_hire,position,department",
      "EMP-1,Jane,Smith,2026-01-15,Nonexistent Role,Nonexistent Dept",
    ].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows[0].errors).toContain('Unknown position "Nonexistent Role".');
    expect(result.rows[0].errors).toContain('Unknown department "Nonexistent Dept".');
  });

  it("leaves position/department null when left blank rather than erroring", () => {
    const csv = ["employee_number,first_name,last_name,date_of_hire", "EMP-1,Jane,Smith,2026-01-15"].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows[0].errors).toHaveLength(0);
    expect(result.rows[0].resolved?.positionId).toBeNull();
    expect(result.rows[0].resolved?.departmentId).toBeNull();
  });

  it("rejects an invalid employment status", () => {
    const csv = [
      "employee_number,first_name,last_name,date_of_hire,employment_status",
      "EMP-1,Jane,Smith,2026-01-15,retired",
    ].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows[0].errors).toContain("Employment status must be one of: active, leave, inactive, terminated.");
  });

  it("rejects an invalid email address", () => {
    const csv = ["employee_number,first_name,last_name,date_of_hire,email", "EMP-1,Jane,Smith,2026-01-15,not-an-email"].join(
      "\n"
    );
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows[0].errors).toContain("Email address is not valid.");
  });

  it("numbers rows starting at 2 (the header is row 1)", () => {
    const csv = [
      "employee_number,first_name,last_name,date_of_hire",
      "EMP-1,Jane,Smith,2026-01-15",
      "EMP-2,John,Doe,2026-01-16",
    ].join("\n");
    const result = parseEmployeeImportCsv(csv, baseContext);
    expect(result.rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
});
