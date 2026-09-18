import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          You have no notifications yet. You&apos;ll see expiration warnings and renewal confirmations here as soon as the notification job (Phase 7) is wired up.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {notifications.map((n) => (
            <li key={n.id} className={`p-4 ${n.is_read ? "" : "bg-brand-50/40"}`}>
              <p className="text-sm font-medium text-slate-900">{n.title}</p>
              <p className="text-sm text-slate-600">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
