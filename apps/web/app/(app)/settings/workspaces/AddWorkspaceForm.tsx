"use client";

import { useFormState } from "react-dom";
import { INDUSTRIES } from "@compliance/shared";
import { addWorkspaceAction, type ActionResult } from "./actions";

const initialState: ActionResult = {};

export function AddWorkspaceForm({ existingIndustryKeys }: { existingIndustryKeys: string[] }) {
  const [state, formAction] = useFormState(addWorkspaceAction, initialState);
  const existing = new Set(existingIndustryKeys);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="industry" className="block text-sm font-medium text-slate-700">
          Industry
        </label>
        <select
          id="industry"
          name="industry"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="" disabled>
            Select an industry
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry.key} value={industry.key} disabled={existing.has(industry.key)}>
              {industry.name}
              {existing.has(industry.key) ? " (already added)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Only Healthcare ships with a starter set of requirements today. Other industries start with an empty,
          fully configurable requirement catalog under Settings → Credential Types once the workspace is created.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Add Workspace
      </button>
    </form>
  );
}
