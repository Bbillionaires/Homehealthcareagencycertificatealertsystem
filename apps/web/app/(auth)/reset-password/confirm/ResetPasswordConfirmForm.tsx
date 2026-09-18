"use client";

import { useFormState } from "react-dom";
import { PasswordField } from "@/components/PasswordField";
import { updatePasswordAction, type ActionResult } from "../../actions";

const initialState: ActionResult = {};

export function ResetPasswordConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        id="password"
        name="password"
        label="New password"
        minLength={8}
        autoComplete="new-password"
      />

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Update password
      </button>
    </form>
  );
}
