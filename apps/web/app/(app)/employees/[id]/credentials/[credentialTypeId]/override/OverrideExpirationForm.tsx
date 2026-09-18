"use client";

import { useFormState } from "react-dom";
import { overrideExpirationAction, type ActionResult } from "./actions";

const initialState: ActionResult = {};

export function OverrideExpirationForm({
  employeeId,
  employeeCredentialId,
}: {
  employeeId: string;
  employeeCredentialId: string;
}) {
  const [state, formAction] = useFormState(overrideExpirationAction, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="employeeCredentialId" value={employeeCredentialId} />

      <div>
        <label htmlFor="newExpirationDate" className="block text-sm font-medium text-slate-700">
          New Expiration Date
        </label>
        <input
          id="newExpirationDate"
          name="newExpirationDate"
          type="date"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
          Reason (required)
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
        Override Expiration
      </button>
    </form>
  );
}
