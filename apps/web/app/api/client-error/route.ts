import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db/context";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Best-effort landing spot for global-error.tsx's beacon: turns an
 * otherwise-invisible client-side crash into a row someone can query.
 * Deliberately no auth requirement -- a crash can happen on the login
 * page before any session exists -- and deliberately never throws back
 * to the caller: a broken error reporter must never itself become the
 * thing a tester has to report.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: string;
      digest?: string;
      stack?: string;
      url?: string;
    };
    if (!body.message || !body.url) {
      return NextResponse.json({ error: "Missing message/url." }, { status: 400 });
    }

    const user = await getSessionUser().catch(() => null);

    await withDb((client) =>
      client.query(
        `INSERT INTO client_error_reports (message, digest, stack, url, user_agent, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          body.message!.slice(0, 2000),
          body.digest?.slice(0, 200) ?? null,
          body.stack?.slice(0, 8000) ?? null,
          body.url!.slice(0, 2000),
          request.headers.get("user-agent")?.slice(0, 500) ?? null,
          user?.id ?? null,
        ]
      )
    );
  } catch {
    // Swallow -- logging a crash must never itself fail loudly to the client.
  }

  return NextResponse.json({ ok: true });
}
