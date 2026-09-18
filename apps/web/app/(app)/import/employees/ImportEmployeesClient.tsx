"use client";

import { useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { parseEmployeeImportCsv, type EmployeeImportParseResult } from "@compliance/shared";
import { importEmployeesAction, type ImportResult } from "./actions";

const initialState: ImportResult = {};

export function ImportEmployeesClient({
  positions,
  departments,
  existingEmployeeNumbers,
}: {
  positions: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  existingEmployeeNumbers: string[];
}) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<EmployeeImportParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useFormState(importEmployeesAction, initialState);

  const context = useMemo(
    () => ({
      existingEmployeeNumbers: new Set(existingEmployeeNumbers.map((n) => n.toLowerCase())),
      positionNamesToId: new Map(positions.map((p) => [p.name.toLowerCase(), p.id])),
      departmentNamesToId: new Map(departments.map((d) => [d.name.toLowerCase(), d.id])),
    }),
    [positions, departments, existingEmployeeNumbers]
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setPreview(parseEmployeeImportCsv(text, context));
  }

  const validCount = preview?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const errorCount = (preview?.rows.length ?? 0) - validCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <a
          href="/employee-import-template.csv"
          download
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Download CSV template
        </a>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Choose CSV file
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
        {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
      </div>

      {preview && preview.headerErrors.length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {preview.headerErrors[0]}
        </p>
      )}

      {preview && preview.headerErrors.length === 0 && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{validCount}</span> row{validCount === 1 ? "" : "s"} ready to
            import
            {errorCount > 0 && (
              <>
                {" "}
                · <span className="font-medium text-red-700">{errorCount}</span> row{errorCount === 1 ? "" : "s"} with
                errors (will be skipped)
              </>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Date of Hire</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className={row.errors.length > 0 ? "bg-red-50/40" : undefined}>
                    <td className="px-4 py-3 text-slate-500">{row.rowNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{row.raw.employee_number}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {row.raw.first_name} {row.raw.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.raw.date_of_hire}</td>
                    <td className="px-4 py-3">
                      {row.errors.length === 0 ? (
                        <span className="text-green-700">Ready</span>
                      ) : (
                        <span className="text-red-700">{row.errors.join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={formAction}>
            <input type="hidden" name="csvText" value={csvText} />
            <button
              type="submit"
              disabled={validCount === 0}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import {validCount} employee{validCount === 1 ? "" : "s"}
            </button>
          </form>
        </>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.imported !== undefined && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Imported {state.imported} employee{state.imported === 1 ? "" : "s"}.</p>
          {state.skipped && state.skipped.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-red-700">
              {state.skipped.map((s) => (
                <li key={s.rowNumber}>
                  Row {s.rowNumber}: {s.errors.join(" ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
