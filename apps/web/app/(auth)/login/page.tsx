"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import { loginAction, type ActionResult } from "../actions";

const initialState: ActionResult = {};

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Access your compliance dashboard.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <PasswordField id="password" name="password" label="Password" autoComplete="current-password" />

          {state.error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Sign in
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm">
          <Link href="/reset-password" className="text-brand-600 hover:underline">
            Forgot password?
          </Link>
          <Link href="/signup" className="text-brand-600 hover:underline">
            Create an organization
          </Link>
        </div>
      </div>
    </div>
  );
}
