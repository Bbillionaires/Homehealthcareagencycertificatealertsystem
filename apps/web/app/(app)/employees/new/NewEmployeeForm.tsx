"use client";

import { useFormState } from "react-dom";
import { createEmployeeAction, type ActionResult } from "../actions";

const initialState: ActionResult = {};

export function NewEmployeeForm({
  positions,
  departments,
}: {
  positions: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(createEmployeeAction, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <TextField name="employeeNumber" label="Employee ID" required />
        <DateField name="dateOfHire" label="Date of Hire" required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField name="firstName" label="First Name" required />
        <TextField name="middleName" label="Middle Name" />
        <TextField name="lastName" label="Last Name" required />
      </div>
      <TextField name="preferredName" label="Preferred Name" />
      <div className="grid grid-cols-2 gap-4">
        <SelectField name="positionId" label="Position" options={positions} placeholder="Select a position" />
        <SelectField name="departmentId" label="Department" options={departments} placeholder="Select a department" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField name="phone" label="Phone" type="tel" />
        <TextField name="email" label="Email" type="email" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Employment Status</label>
        <select
          name="employmentStatus"
          defaultValue="active"
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
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Save Employee
      </button>
    </form>
  );
}

function TextField({
  name,
  label,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
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
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function DateField({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return <TextField name={name} label={label} required={required} type="date" />;
}

function SelectField({
  name,
  label,
  options,
  placeholder,
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
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
