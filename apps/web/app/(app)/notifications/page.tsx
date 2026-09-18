import { requireOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const ctx = await requireOrgContext();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, severity, is_read, created_at")
    .eq("recipient_user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>

      {!notifications || notifications.length === 0 ? (
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
