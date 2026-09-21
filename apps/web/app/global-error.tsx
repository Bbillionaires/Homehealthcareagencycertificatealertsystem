"use client";

import { useEffect } from "react";

/**
 * Next.js's special root-level error boundary: catches anything the
 * normal React tree (and the route-level error.tsx below it) didn't
 * catch. It replaces the entire page, so -- unusually for a component in
 * this app -- it has to render its own <html>/<body>, and it can't
 * import globals.css or rely on any layout that might itself be what
 * crashed.
 *
 * Before this existed, every uncaught client exception rendered Next's
 * generic "a client-side exception has occurred, see the browser
 * console" message -- useless to a tester without devtools open, and
 * completely invisible to us. This shows the real error message instead
 * and best-effort reports it to /api/client-error so it shows up in
 * client_error_reports without needing anyone to screenshot a console.
 */
export default function GlobalError({
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
    <html lang="en">
      <body style={{ background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
            This has been reported. If it keeps happening, share this message with support:
          </p>
          <p
            style={{
              marginTop: 16,
              padding: 12,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              wordBreak: "break-word",
              textAlign: "left",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest && (
              <>
                <br />
                <span style={{ color: "#64748b" }}>Reference: {error.digest}</span>
              </>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
