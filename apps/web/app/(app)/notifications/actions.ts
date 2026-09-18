"use server";

import { revalidatePath } from "next/cache";
import { withUserContext } from "@/lib/db/context";
import { requireOrgContext } from "@/lib/session";

export async function markAllNotificationsReadAction() {
  const ctx = await requireOrgContext();

  await withUserContext(ctx.userId, (client) =>
    client.query("UPDATE notifications SET is_read = true, read_at = now() WHERE recipient_user_id = $1 AND NOT is_read", [
      ctx.userId,
    ])
  );

  revalidatePath("/notifications");
}
