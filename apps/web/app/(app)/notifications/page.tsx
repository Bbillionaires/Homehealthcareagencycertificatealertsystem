import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { markAllNotificationsReadAction } from "./actions";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-slate-400",
  warning: "bg-amber-500",
  urgent: "bg-orange-500",
  critical: "bg-red-500",
};

export default async function NotificationsPage() {
  const ctx = await requireOrgContext();

  const notifications = await withUserContext(ctx.userId, async (client) => {
    const result = await client.query<{
      id: string;
      title: string;
      body: string;
      severity: string;
      is_read: boolean;
      created_at: string;
    }>(
      `SELECT id, title, body, severity, is_read, created_at
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [ctx.userId]
    );
    return result.rows;
  });

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
        {hasUnread && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          You have no notifications. Expiration warnings, missing-documentation alerts, and renewal confirmations
          will show up here as they happen.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {notifications.map((n) => (
            <li key={n.id} className={`flex gap-3 p-4 ${n.is_read ? "" : "bg-brand-50/40"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] ?? "bg-slate-400"}`} />
              <div>
                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                <p className="whitespace-pre-line text-sm text-slate-600">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
