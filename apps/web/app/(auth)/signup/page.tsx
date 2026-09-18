"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signUpAction, type ActionResult } from "../actions";

const initialState: ActionResult = {};

export default function SignUpPage() {
  const [state, formAction] = useFormState(signUpAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Create your organization</h1>
        <p className="mt-1 text-sm text-slate-500">
          You&apos;ll be the Owner and can invite an Office Manager afterward.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <Field id="organizationName" label="Organization name" type="text" />
          <Field id="fullName" label="Your name" type="text" />
          <Field id="email" label="Email" type="email" />
          <Field id="password" label="Password" type="password" helpText="At least 8 characters." />

          {state.error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Create organization
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  helpText,
}: {
  id: string;
  label: string;
  type: string;
  helpText?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {helpText && <p className="mt-1 text-xs text-slate-400">{helpText}</p>}
    </div>
  );
}
