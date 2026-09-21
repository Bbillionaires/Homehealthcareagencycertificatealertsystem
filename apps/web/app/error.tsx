"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary: catches a crash inside a page/layout
 * without tearing down the whole app the way global-error.tsx (the
 * root-level fallback for a crash global-error itself, or one outside
 * any route) has to. Same reporting beacon as global-error.tsx, so
 * every crash lands in client_error_reports regardless of which
 * boundary actually caught it.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">This has been reported. If it keeps happening, share this message with support:</p>
        <p className="mt-4 break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700">
          {error.message || "Unknown error"}
          {error.digest && (
            <>
              <br />
              <span className="text-slate-400">Reference: {error.digest}</span>
            </>
          )}
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
