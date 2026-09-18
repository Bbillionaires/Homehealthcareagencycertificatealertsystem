import type { PoolClient } from "pg";

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

/**
 * Every mutation that touches employee/credential data should call this
 * with the SAME client (and therefore the same transaction) it used for
 * the mutation itself, so the audit entry can never succeed without the
 * change it's describing, or vice versa.
 */
export async function recordAuditLog(client: PoolClient, entry: AuditEntry): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (
       organization_id, actor_user_id, action, entity_type, entity_id,
       affected_employee_id, previous_value, new_value, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.organizationId,
      entry.actorUserId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.affectedEmployeeId ?? null,
      entry.previousValue ? JSON.stringify(entry.previousValue) : null,
      entry.newValue ? JSON.stringify(entry.newValue) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ]
  );
}
