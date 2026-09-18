"use client";

import { useFormState } from "react-dom";
import { updateOrgSettingsAction, type ActionResult } from "./actions";

const initialState: ActionResult = {};

export function OrgSettingsForm({
  yellowThresholdDays,
  orangeThresholdDays,
  notifyScheduleDays,
}: {
  yellowThresholdDays: number;
  orangeThresholdDays: number;
  notifyScheduleDays: number[];
}) {
  const [state, formAction] = useFormState(updateOrgSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Compliance Thresholds &amp; Notification Schedule</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="complianceYellowThresholdDays" className="block text-sm font-medium text-slate-700">
            Green / Yellow boundary (days remaining)
          </label>
          <input
            id="complianceYellowThresholdDays"
            name="complianceYellowThresholdDays"
            type="number"
            min={1}
            required
            defaultValue={yellowThresholdDays}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="complianceOrangeThresholdDays" className="block text-sm font-medium text-slate-700">
            Yellow / Orange boundary (days remaining)
          </label>
          <input
            id="complianceOrangeThresholdDays"
            name="complianceOrangeThresholdDays"
            type="number"
            min={1}
            required
            defaultValue={orangeThresholdDays}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>
      <div>
        <label htmlFor="notifyScheduleDays" className="block text-sm font-medium text-slate-700">
          Notification schedule (comma-separated days before expiration)
        </label>
        <input
          id="notifyScheduleDays"
          name="notifyScheduleDays"
          type="text"
          defaultValue={notifyScheduleDays.join(", ")}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="mt-1 text-xs text-slate-400">Alerts continue daily once a credential is overdue, regardless of this list.</p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Settings saved.
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Save Settings
      </button>
    </form>
  );
}
