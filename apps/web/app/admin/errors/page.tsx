import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { withDb } from "@/lib/db/context";
import { logoutAction } from "../../(auth)/actions";

interface ErrorReportRow {
  id: string;
  message: string;
  digest: string | null;
  stack: string | null;
  url: string;
  user_agent: string | null;
  user_email: string | null;
  created_at: Date;
}

/**
 * Read-only feed of client_error_reports (see db/migrations/0006 and
 * global-error.tsx/error.tsx) -- the only place a client-side crash a
 * tester hits without devtools open is actually visible to us.
 */
export default async function AdminErrorsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/dashboard");

  const reports = await withDb((client) =>
    client.query<ErrorReportRow>(
      `SELECT cer.id, cer.message, cer.digest, cer.stack, cer.url, cer.user_agent, u.email AS user_email, cer.created_at
       FROM client_error_reports cer
       LEFT JOIN users u ON u.id = cer.user_id
       ORDER BY cer.created_at DESC
       LIMIT 100`
    )
  );

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Platform Admin · Client Errors</h1>
            <p className="mt-1 text-sm text-slate-500">
              The last 100 uncaught client-side crashes reported by global-error.tsx / error.tsx.
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              Sign out
            </button>
          </form>
        </div>

        {reports.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No crashes reported yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {reports.rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-slate-900">{r.message}</p>
                  <span className="whitespace-nowrap text-xs text-slate-400">{r.created_at.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {r.url}
                  {r.user_email ? ` · ${r.user_email}` : " · not signed in"}
                  {r.digest ? ` · ref ${r.digest}` : ""}
                </p>
                {r.user_agent && <p className="mt-1 text-xs text-slate-400">{r.user_agent}</p>}
                {r.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-brand-600">Stack trace</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                      {r.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
