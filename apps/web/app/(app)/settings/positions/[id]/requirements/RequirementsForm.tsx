"use client";

import { useFormState } from "react-dom";
import { updatePositionRequirementsAction, type RequirementsResult } from "../../actions";

const initialState: RequirementsResult = {};

export function RequirementsForm({
  positionId,
  credentialTypes,
  initialSelections,
}: {
  positionId: string;
  credentialTypes: { id: string; name: string; category: string }[];
  initialSelections: Record<string, "required" | "optional" | "not_applicable">;
}) {
  const [state, formAction] = useFormState(updatePositionRequirementsAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="positionId" value={positionId} />

      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2">Credential</th>
            <th className="py-2">Category</th>
            <th className="py-2">Applicability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {credentialTypes.map((ct) => (
            <tr key={ct.id}>
              <td className="py-2 font-medium text-slate-900">
                {ct.name}
                <input type="hidden" name="credentialTypeId" value={ct.id} />
              </td>
              <td className="py-2 capitalize text-slate-500">{ct.category.replace("_", " ")}</td>
              <td className="py-2">
                <select
                  name={`requirement_${ct.id}`}
                  defaultValue={initialSelections[ct.id] ?? "not_applicable"}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="not_applicable">Not applicable</option>
                  <option value="required">Required</option>
                  <option value="optional">Optional</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {credentialTypes.length === 0 && (
        <p className="text-sm text-slate-500">No active credential types yet -- add one under Settings &rsaquo; Credential Types first.</p>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Requirements saved.
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Save Requirements
      </button>
    </form>
  );
}
