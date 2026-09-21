"use client";

import { useFormState } from "react-dom";
import { renewCredentialAction, type ActionResult } from "./actions";

const initialState: ActionResult = {};

export function RenewCredentialForm({
  employeeId,
  credentialTypeId,
  requiresDocument,
}: {
  employeeId: string;
  credentialTypeId: string;
  requiresDocument: boolean;
}) {
  const [state, formAction] = useFormState(renewCredentialAction, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="credentialTypeId" value={credentialTypeId} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="completionDate" className="block text-sm font-medium text-slate-700">
            Completion Date
          </label>
          <input
            id="completionDate"
            name="completionDate"
            type="date"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-slate-400">Expiration is calculated automatically from this date.</p>
        </div>
        <div>
          <label htmlFor="issueDate" className="block text-sm font-medium text-slate-700">
            Issue Date (optional)
          </label>
          <input
            id="issueDate"
            name="issueDate"
            type="date"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="certificateNumber" className="block text-sm font-medium text-slate-700">
            Certificate Number
          </label>
          <input
            id="certificateNumber"
            name="certificateNumber"
            type="text"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="issuingOrganization" className="block text-sm font-medium text-slate-700">
            Issuing Organization / Provider
          </label>
          <input
            id="issuingOrganization"
            name="issuingOrganization"
            type="text"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {requiresDocument && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This credential requires a document. Save the dates here first, then use the &ldquo;Documents&rdquo; link on the employee&apos;s profile to upload the certificate (or a photo of it) — admins and the employee can both download it later.
        </p>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Save Renewal
      </button>
    </form>
  );
}
