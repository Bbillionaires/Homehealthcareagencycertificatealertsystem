"use client";

import { useFormState } from "react-dom";
import type { ActionResult } from "./actions";

const initialState: ActionResult = {};

export interface CredentialTypeFormValues {
  id?: string;
  key?: string;
  name?: string;
  description?: string;
  category?: string;
  renewalIntervalValue?: number | null;
  renewalIntervalUnit?: string | null;
  requiresDocument?: boolean;
  isRequiredDefault?: boolean;
  warningYellowThresholdDays?: number | null;
  warningOrangeThresholdDays?: number | null;
  isActive?: boolean;
}

export function CredentialTypeForm({
  action,
  defaultValues,
  submitLabel,
  isNew,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaultValues?: CredentialTypeFormValues;
  submitLabel: string;
  isNew: boolean;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="key" className="block text-sm font-medium text-slate-700">
            Key
          </label>
          {isNew ? (
            <input
              id="key"
              name="key"
              type="text"
              required
              placeholder="e.g. flu_vaccine"
              pattern="[a-z0-9_]+"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          ) : (
            <input
              type="text"
              value={defaultValues?.key ?? ""}
              disabled
              className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          )}
          <p className="mt-1 text-xs text-slate-400">Lowercase, underscores only. Cannot be changed later.</p>
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? "training"}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="training">Training</option>
            <option value="background_check">Background Check</option>
            <option value="document">Document</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues?.name}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaultValues?.description}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="renewalIntervalValue" className="block text-sm font-medium text-slate-700">
            Renewal Interval
          </label>
          <input
            id="renewalIntervalValue"
            name="renewalIntervalValue"
            type="number"
            min={1}
            defaultValue={defaultValues?.renewalIntervalValue ?? undefined}
            placeholder="Leave blank if it never expires"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="renewalIntervalUnit" className="block text-sm font-medium text-slate-700">
            Unit
          </label>
          <select
            id="renewalIntervalUnit"
            name="renewalIntervalUnit"
            defaultValue={defaultValues?.renewalIntervalUnit ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Never expires</option>
            <option value="days">Days</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="warningYellowThresholdDays" className="block text-sm font-medium text-slate-700">
            Yellow Warning (days remaining)
          </label>
          <input
            id="warningYellowThresholdDays"
            name="warningYellowThresholdDays"
            type="number"
            min={1}
            defaultValue={defaultValues?.warningYellowThresholdDays ?? undefined}
            placeholder="Org default (90)"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="warningOrangeThresholdDays" className="block text-sm font-medium text-slate-700">
            Orange Warning (days remaining)
          </label>
          <input
            id="warningOrangeThresholdDays"
            name="warningOrangeThresholdDays"
            type="number"
            min={1}
            defaultValue={defaultValues?.warningOrangeThresholdDays ?? undefined}
            placeholder="Org default (60)"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="requiresDocument" defaultChecked={defaultValues?.requiresDocument ?? true} />
          Requires supporting document
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isRequiredDefault" defaultChecked={defaultValues?.isRequiredDefault ?? true} />
          Required by default for new positions
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
          Active
        </label>
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        {submitLabel}
      </button>
    </form>
  );
}
