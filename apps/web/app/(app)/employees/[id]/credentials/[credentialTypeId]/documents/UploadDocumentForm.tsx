"use client";

import { useFormState } from "react-dom";
import { uploadCredentialDocumentAction, type UploadResult } from "./actions";

const initialState: UploadResult = {};

export function UploadDocumentForm({
  employeeId,
  credentialTypeId,
  disabled,
}: {
  employeeId: string;
  credentialTypeId: string;
  disabled: boolean;
}) {
  const [state, formAction] = useFormState(uploadCredentialDocumentAction, initialState);

  return (
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
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Document uploaded.
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
  );
}
