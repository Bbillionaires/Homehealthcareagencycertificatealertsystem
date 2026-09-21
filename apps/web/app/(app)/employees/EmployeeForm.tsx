"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { ActionResult } from "./actions";
import { voiceFillEmployeeAction } from "./voiceActions";
import { VoiceCaptureButton } from "@/components/VoiceCaptureButton";

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

const EMPLOYMENT_STATUSES = ["active", "leave", "inactive", "terminated"];

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
  const [values, setValues] = useState<EmployeeFormValues>({
    employmentStatus: "active",
    ...defaultValues,
  });
  const [transcript, setTranscript] = useState<string | null>(null);

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleVoiceRecording(blob: Blob) {
    const formData = new FormData();
    formData.set("audio", blob, "recording.webm");
    const result = await voiceFillEmployeeAction(formData);
    if (result.error) throw new Error(result.error);
    setTranscript(result.transcript);
    const fields = { ...result.fields };
    if (fields.employmentStatus) {
      const normalized = fields.employmentStatus.toLowerCase();
      fields.employmentStatus = EMPLOYMENT_STATUSES.includes(normalized) ? normalized : undefined;
    }
    setValues((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== "")),
    }));
  }

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      {employeeId && <input type="hidden" name="employeeId" value={employeeId} />}

      <div className="rounded-md bg-slate-50 p-3">
        <VoiceCaptureButton onAudioReady={handleVoiceRecording} label="Fill this form by voice" />
        {transcript && <p className="mt-2 text-xs text-slate-500">Heard: &ldquo;{transcript}&rdquo;</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          name="employeeNumber"
          label="Employee ID"
          required
          value={values.employeeNumber ?? ""}
          onChange={(v) => set("employeeNumber", v)}
        />
        <DateField
          name="dateOfHire"
          label="Date of Hire"
          required
          value={values.dateOfHire ?? ""}
          onChange={(v) => set("dateOfHire", v)}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField
          name="firstName"
          label="First Name"
          required
          value={values.firstName ?? ""}
          onChange={(v) => set("firstName", v)}
        />
        <TextField
          name="middleName"
          label="Middle Name"
          value={values.middleName ?? ""}
          onChange={(v) => set("middleName", v)}
        />
        <TextField
          name="lastName"
          label="Last Name"
          required
          value={values.lastName ?? ""}
          onChange={(v) => set("lastName", v)}
        />
      </div>
      <TextField
        name="preferredName"
        label="Preferred Name"
        value={values.preferredName ?? ""}
        onChange={(v) => set("preferredName", v)}
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          name="positionId"
          label="Position"
          options={positions}
          placeholder="Select a position"
          value={values.positionId ?? ""}
          onChange={(v) => set("positionId", v)}
        />
        <SelectField
          name="departmentId"
          label="Department"
          options={departments}
          placeholder="Select a department"
          value={values.departmentId ?? ""}
          onChange={(v) => set("departmentId", v)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          name="phone"
          label="Phone"
          type="tel"
          value={values.phone ?? ""}
          onChange={(v) => set("phone", v)}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          value={values.email ?? ""}
          onChange={(v) => set("email", v)}
        />
      </div>
      <div>
        <label htmlFor="employmentStatus" className="block text-sm font-medium text-slate-700">
          Employment Status
        </label>
        <select
          id="employmentStatus"
          name="employmentStatus"
          value={values.employmentStatus ?? "active"}
          onChange={(e) => set("employmentStatus", e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
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
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
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
  value,
  onChange,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function DateField({
  name,
  label,
  required,
  value,
  onChange,
}: {
  name: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return <TextField name={name} label={label} required={required} type="date" value={value} onChange={onChange} />;
}

function SelectField({
  name,
  label,
  options,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
