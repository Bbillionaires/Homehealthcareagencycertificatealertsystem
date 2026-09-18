/**
 * CSV parsing/validation for the employee bulk-import flow (§36 of the
 * brief). Framework- and database-agnostic like the rest of this
 * package: callers pass in the org's existing positions/departments/
 * employee numbers so duplicate detection and position/department
 * lookups don't need a live connection to run or test.
 */

const REQUIRED_COLUMNS = ["employee_number", "first_name", "last_name", "date_of_hire"] as const;
const ALL_COLUMNS = [
  "employee_number",
  "first_name",
  "middle_name",
  "last_name",
  "preferred_name",
  "date_of_hire",
  "position",
  "department",
  "employment_status",
  "email",
  "phone",
  "notes",
] as const;

export type EmployeeImportColumn = (typeof ALL_COLUMNS)[number];

export const EMPLOYEE_IMPORT_TEMPLATE_HEADER = ALL_COLUMNS.join(",");

const VALID_EMPLOYMENT_STATUSES = new Set(["active", "leave", "inactive", "terminated"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface EmployeeImportRowResult {
  /** 1-based, matching the row's position in the file including the header. */
  rowNumber: number;
  raw: Record<EmployeeImportColumn, string>;
  errors: string[];
  /** Present only when errors is empty. */
  resolved?: {
    employeeNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    preferredName: string | null;
    dateOfHire: string;
    positionId: string | null;
    departmentId: string | null;
    employmentStatus: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}

export interface EmployeeImportParseResult {
  /** Non-empty only when the header row itself is unusable; rows will be empty in that case. */
  headerErrors: string[];
  rows: EmployeeImportRowResult[];
}

/** Minimal RFC4180 CSV parser: quoted fields, embedded commas/newlines, doubled-quote escaping. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Normalize CRLF/CR to LF up front so the scanner only handles \n.
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < normalized.length) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Flush the final field/row (files without a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export function parseEmployeeImportCsv(
  csvText: string,
  context: {
    existingEmployeeNumbers: Set<string>; // lowercased
    positionNamesToId: Map<string, string>; // lowercased name -> id
    departmentNamesToId: Map<string, string>; // lowercased name -> id
  }
): EmployeeImportParseResult {
  const table = parseCsv(csvText);
  if (table.length === 0) {
    return { headerErrors: ["The file is empty."], rows: [] };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missingRequired = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
  if (missingRequired.length > 0) {
    return { headerErrors: [`Missing required column(s): ${missingRequired.join(", ")}.`], rows: [] };
  }

  const columnIndex = new Map(header.map((name, idx) => [name, idx]));
  const seenInBatch = new Set<string>();

  const rows: EmployeeImportRowResult[] = table.slice(1).map((cells, i) => {
    const get = (col: EmployeeImportColumn) => (cells[columnIndex.get(col) ?? -1] ?? "").trim();

    const raw = Object.fromEntries(ALL_COLUMNS.map((col) => [col, get(col)])) as Record<EmployeeImportColumn, string>;
    const errors: string[] = [];

    const employeeNumber = raw.employee_number;
    const firstName = raw.first_name;
    const lastName = raw.last_name;
    const dateOfHire = raw.date_of_hire;

    if (!employeeNumber) errors.push("Employee ID is required.");
    if (!firstName) errors.push("First name is required.");
    if (!lastName) errors.push("Last name is required.");
    if (!dateOfHire) {
      errors.push("Date of hire is required.");
    } else if (!DATE_PATTERN.test(dateOfHire)) {
      errors.push("Date of hire must be in YYYY-MM-DD format.");
    }

    const employeeNumberKey = employeeNumber.toLowerCase();
    if (employeeNumber) {
      if (context.existingEmployeeNumbers.has(employeeNumberKey)) {
        errors.push(`Employee ID "${employeeNumber}" already exists.`);
      } else if (seenInBatch.has(employeeNumberKey)) {
        errors.push(`Employee ID "${employeeNumber}" is duplicated earlier in this file.`);
      }
      seenInBatch.add(employeeNumberKey);
    }

    let positionId: string | null = null;
    if (raw.position) {
      const match = context.positionNamesToId.get(raw.position.toLowerCase());
      if (!match) {
        errors.push(`Unknown position "${raw.position}".`);
      } else {
        positionId = match;
      }
    }

    let departmentId: string | null = null;
    if (raw.department) {
      const match = context.departmentNamesToId.get(raw.department.toLowerCase());
      if (!match) {
        errors.push(`Unknown department "${raw.department}".`);
      } else {
        departmentId = match;
      }
    }

    const employmentStatus = raw.employment_status ? raw.employment_status.toLowerCase() : "active";
    if (!VALID_EMPLOYMENT_STATUSES.has(employmentStatus)) {
      errors.push(`Employment status must be one of: active, leave, inactive, terminated.`);
    }

    if (raw.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email)) {
      errors.push("Email address is not valid.");
    }

    const result: EmployeeImportRowResult = { rowNumber: i + 2, raw, errors };

    if (errors.length === 0) {
      result.resolved = {
        employeeNumber,
        firstName,
        middleName: raw.middle_name || null,
        lastName,
        preferredName: raw.preferred_name || null,
        dateOfHire,
        positionId,
        departmentId,
        employmentStatus,
        email: raw.email || null,
        phone: raw.phone || null,
        notes: raw.notes || null,
      };
    }

    return result;
  });

  return { headerErrors: [], rows };
}
