"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { uploadCredentialDocumentAction, applyExtractedDateAction, type UploadResult, type DateMismatch } from "./actions";

const initialState: UploadResult = {};

export function UploadDocumentForm({
  employeeId,
  credentialTypeId,
  employeeCredentialId,
  currentCompletionDate,
  currentExpirationDate,
  disabled,
}: {
  employeeId: string;
  credentialTypeId: string;
  employeeCredentialId: string;
  currentCompletionDate: string | null;
  currentExpirationDate: string | null;
  disabled: boolean;
}) {
  const [state, formAction] = useFormState(uploadCredentialDocumentAction, initialState);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyDate(mismatch: DateMismatch, field: "completion" | "expiration") {
    setApplyError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("employeeCredentialId", employeeCredentialId);
      formData.set("employeeId", employeeId);
      formData.set("credentialTypeId", credentialTypeId);
      formData.set("field", field);
      formData.set("newDate", mismatch.extractedDate);
      const result = await applyExtractedDateAction(formData);
      if (result.error) {
        setApplyError(result.error);
      } else {
        setResolved((prev) => new Set(prev).add(mismatch.label + mismatch.extractedDate));
      }
    });
  }

  const openMismatches = (state.mismatches ?? []).filter((m) => !resolved.has(m.label + m.extractedDate));

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="credentialTypeId" value={credentialTypeId} />

        <div>
          <label htmlFor="file" className="block text-sm font-medium text-slate-700">
            Upload Document (PDF, JPG, or PNG, up to 20 MB)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={disabled}
            required
            className="mt-1 block w-full text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-400">
            JPG/PNG uploads are automatically scanned for printed dates, which are checked against{" "}
            {currentCompletionDate || currentExpirationDate ? "the dates on file" : "this record"}.
          </p>
        </div>

        {state.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Document uploaded.
            {state.mismatches && state.mismatches.length === 0 && " The dates on it match what's on file."}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Upload
        </button>
      </form>

      {openMismatches.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-900">
            This document shows a date that doesn&apos;t match what&apos;s on file:
          </p>
          <ul className="space-y-3">
            {openMismatches.map((m) => (
              <li key={m.label + m.extractedDate} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                <span className="text-sm text-slate-700">
                  <span className="font-medium">{m.label}:</span> {m.extractedDate}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => applyDate(m, "completion")}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Use as Completion Date
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => applyDate(m, "expiration")}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Use as Expiration Date
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {applyError && <p className="text-xs text-red-600">{applyError}</p>}
        </div>
      )}
    </div>
  );
}
