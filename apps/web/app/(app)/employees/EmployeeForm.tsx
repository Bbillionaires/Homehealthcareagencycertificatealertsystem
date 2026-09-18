"use client";

import { useFormState } from "react-dom";
import type { ActionResult } from "./actions";

const initialState: ActionResult = {};

export interface EmployeeFormValues {
  employeeNumber?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  dateOfHire?: string;
  positionId?: string;
  departmentId?: string;
  employmentStatus?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export function EmployeeForm({
  action,
  positions,
  departments,
  defaultValues,
  employeeId,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  positions: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  defaultValues?: EmployeeFormValues;
  employeeId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      {employeeId && <input type="hidden" name="employeeId" value={employeeId} />}
      <div className="grid grid-cols-2 gap-4">
        <TextField name="employeeNumber" label="Employee ID" required defaultValue={defaultValues?.employeeNumber} />
        <DateField name="dateOfHire" label="Date of Hire" required defaultValue={defaultValues?.dateOfHire} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField name="firstName" label="First Name" required defaultValue={defaultValues?.firstName} />
        <TextField name="middleName" label="Middle Name" defaultValue={defaultValues?.middleName} />
        <TextField name="lastName" label="Last Name" required defaultValue={defaultValues?.lastName} />
      </div>
      <TextField name="preferredName" label="Preferred Name" defaultValue={defaultValues?.preferredName} />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          name="positionId"
          label="Position"
          options={positions}
          placeholder="Select a position"
          defaultValue={defaultValues?.positionId}
        />
        <SelectField
          name="departmentId"
          label="Department"
          options={departments}
          placeholder="Select a department"
          defaultValue={defaultValues?.departmentId}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField name="phone" label="Phone" type="tel" defaultValue={defaultValues?.phone} />
        <TextField name="email" label="Email" type="email" defaultValue={defaultValues?.email} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Employment Status</label>
        <select
          name="employmentStatus"
          defaultValue={defaultValues?.employmentStatus ?? "active"}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="active">Active</option>
          <option value="leave">Leave</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
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

function TextField({
  name,
  label,
  required,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function DateField({
  name,
  label,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return <TextField name={name} label={label} required={required} type="date" defaultValue={defaultValue} />;
}

function SelectField({
  name,
  label,
  options,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
