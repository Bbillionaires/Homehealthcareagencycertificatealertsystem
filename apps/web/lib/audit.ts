import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

interface AuditEntry {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  affectedEmployeeId?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** Every mutation that touches employee/credential data should call this in the same request. */
export async function recordAuditLog(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry
) {
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: entry.organizationId,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    affected_employee_id: entry.affectedEmployeeId ?? null,
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    metadata: entry.metadata ?? null,
  });

  if (error) {
    // Audit logging must never silently vanish; surface it so the calling
    // action can decide whether to roll back / report failure.
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}
