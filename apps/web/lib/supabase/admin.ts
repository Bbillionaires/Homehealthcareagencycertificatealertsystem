import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. SERVER-ONLY — never import this from a Client
 * Component or expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It
 * bypasses RLS entirely, so every call site is responsible for its own
 * authorization check (e.g. org bootstrap on signup, the nightly
 * notification job).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
