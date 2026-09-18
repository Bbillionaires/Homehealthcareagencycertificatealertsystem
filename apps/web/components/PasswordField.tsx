"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Password <input> with a show/hide toggle. Client-only (needs state for
 * the toggle) but still submits as a plain form field -- `name` is what
 * server actions read via FormData, the visibility toggle is purely local
 * UI state.
 */
export function PasswordField({
  id,
  name,
  label,
  required = true,
  minLength,
  helpText,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  minLength?: number;
  helpText?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="block w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
        >
          <Icon name={visible ? "eye-off" : "eye"} className="h-4 w-4" />
        </button>
      </div>
      {helpText && <p className="mt-1 text-xs text-slate-400">{helpText}</p>}
    </div>
  );
}
