import { NextResponse, type NextRequest } from "next/server";
import { runNightlyNotificationCheck } from "@/lib/notifications/runNightlyCheck";

/**
 * Trigger for the daily compliance/expiration check (§34 of the
 * brief). Meant to be hit on a schedule by Railway's cron trigger (or
 * any external scheduler) rather than run inside the request/response
 * cycle of a normal page -- there's no in-process scheduler in a
 * serverless-friendly Next.js app, so an HTTP endpoint plus an external
 * cron is the standard approach.
 *
 * Protected by CRON_SECRET since Route Handlers are public by default;
 * without it set, the endpoint refuses every request rather than
 * silently running unauthenticated.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runNightlyNotificationCheck();
  return NextResponse.json(summary);
}
