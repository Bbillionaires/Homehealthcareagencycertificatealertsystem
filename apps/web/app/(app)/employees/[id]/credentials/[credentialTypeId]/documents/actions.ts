"use server";

import { revalidatePath } from "next/cache";
import { addCalendarInterval, type IntervalUnit } from "@compliance/shared";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { recordAuditLog } from "@/lib/audit";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  buildDocumentKey,
  isStorageConfigured,
  uploadDocument,
} from "@/lib/storage";
import { getDocumentDateProvider, OCR_SUPPORTED_MIME_TYPES, type ExtractedDate } from "@/lib/adapters/documentDates";

export interface DateMismatch {
  label: string;
  extractedDate: string;
}

export interface UploadResult {
  error?: string;
  success?: boolean;
  /** Dates the document appears to show that don't match what's on file -- null once everything matches or nothing was scanned. */
  mismatches?: DateMismatch[];
}

export async function uploadCredentialDocumentAction(_prev: UploadResult, formData: FormData): Promise<UploadResult> {
  const ctx = await requireOrgContext();
  const employeeId = String(formData.get("employeeId") ?? "");
  const credentialTypeId = String(formData.get("credentialTypeId") ?? "");

  const isAdmin = ctx.role === "owner" || ctx.role === "office_manager";
  const isSelf = ctx.role === "employee" && ctx.employeeId === employeeId;
  if (!isAdmin && !isSelf) {
    return { error: "You don't have permission to upload documents for this employee." };
  }

  if (!isStorageConfigured()) {
    return {
      error: "Document storage isn't configured yet. Set the RAILWAY_BUCKET_* environment variables to enable uploads.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return { error: "Only PDF, JPG, and PNG files are accepted." };
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { error: "Files must be 20 MB or smaller." };
  }

  let mismatches: DateMismatch[] | undefined;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    await withUserContext(ctx.userId, async (client) => {
      const activeResult = await client.query<{ id: string; completion_date: string | null; expiration_date: string | null }>(
        `SELECT id, completion_date, expiration_date FROM employee_credentials
         WHERE employee_id = $1 AND credential_type_id = $2 AND organization_id = $3 AND status = 'active'`,
        [employeeId, credentialTypeId, ctx.organizationId]
      );
      const active = activeResult.rows[0];
      if (!active) {
        throw new Error("Add a completion date for this credential before attaching a document.");
      }

      const key = buildDocumentKey(ctx.organizationId, employeeId, active.id, file.name);
      await uploadDocument(key, buffer, file.type);

      await client.query(
        "UPDATE credential_documents SET is_current = false WHERE employee_credential_id = $1 AND is_current",
        [active.id]
      );

      await client.query(
        `INSERT INTO credential_documents (
           organization_id, employee_credential_id, storage_path, file_name, mime_type, size_bytes, is_current, uploaded_by
         ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
        [ctx.organizationId, active.id, key, file.name, file.type, file.size, ctx.userId]
      );

      await recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "document.uploaded",
        entityType: "credential_document",
        entityId: active.id,
        affectedEmployeeId: employeeId,
        newValue: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      });

      if (OCR_SUPPORTED_MIME_TYPES.includes(file.type)) {
        mismatches = await findDateMismatches(buffer, file.type, active.completion_date, active.expiration_date);
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to upload document." };
  }

  revalidatePath(`/employees/${employeeId}/credentials/${credentialTypeId}/documents`);
  return { success: true, mismatches };
}

/** Extracted dates that don't equal either date on file -- OCR failures never throw, they just report nothing to check. */
async function findDateMismatches(
  image: Buffer,
  mimeType: string,
  completionDate: string | null,
  expirationDate: string | null
): Promise<DateMismatch[] | undefined> {
  try {
    const result = await getDocumentDateProvider().extractDates(image, mimeType);
    if (!result.scanned) return undefined;
    return result.dates
      .filter((d): d is ExtractedDate & { date: string } => Boolean(d.date))
      .filter((d) => d.date !== completionDate && d.date !== expirationDate)
      .map((d) => ({ label: d.label, extractedDate: d.date }));
  } catch {
    return undefined;
  }
}

export interface ApplyDateResult {
  error?: string;
  success?: boolean;
}

/**
 * Accepts a date OCR found on the document over what's currently on file.
 * Completion date: any admin can correct it, same authorization as a normal
 * renewal, and expiration is recomputed from the credential type's renewal
 * interval exactly like renewCredentialAction does. Expiration date: routed
 * through the same owner-only override columns overrideExpirationAction
 * uses, since accepting a document's expiration date bypasses the computed
 * value the same way a manual override does.
 */
export async function applyExtractedDateAction(formData: FormData): Promise<ApplyDateResult> {
  const ctx = await requireOrgContext();
  const employeeCredentialId = String(formData.get("employeeCredentialId") ?? "");
  const field = String(formData.get("field") ?? "");
  const newDate = String(formData.get("newDate") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const credentialTypeId = String(formData.get("credentialTypeId") ?? "");

  if (!employeeCredentialId || !newDate || (field !== "completion" && field !== "expiration")) {
    return { error: "Invalid request." };
  }

  const isAdmin = ctx.role === "owner" || ctx.role === "office_manager";
  if (field === "completion" && !isAdmin) {
    return { error: "You don't have permission to correct this date." };
  }
  if (field === "expiration" && ctx.role !== "owner") {
    return { error: "Only an Owner can correct an expiration date." };
  }

  try {
    await withUserContext(ctx.userId, async (client) => {
      const currentResult = await client.query<{
        completion_date: string | null;
        expiration_date: string | null;
        renewal_interval_value: number | null;
        renewal_interval_unit: IntervalUnit | null;
      }>(
        `SELECT ec.completion_date, ec.expiration_date, ct.renewal_interval_value, ct.renewal_interval_unit
         FROM employee_credentials ec
         JOIN credential_types ct ON ct.id = ec.credential_type_id
         WHERE ec.id = $1 AND ec.organization_id = $2 AND ec.status = 'active'`,
        [employeeCredentialId, ctx.organizationId]
      );
      const current = currentResult.rows[0];
      if (!current) throw new Error("Credential record not found.");

      if (field === "completion") {
        const newExpiration =
          current.renewal_interval_value && current.renewal_interval_unit
            ? addCalendarInterval(newDate, current.renewal_interval_value, current.renewal_interval_unit)
            : current.expiration_date;

        await client.query(
          `UPDATE employee_credentials SET completion_date = $1, expiration_date = $2, updated_by = $3
           WHERE id = $4 AND organization_id = $5`,
          [newDate, newExpiration, ctx.userId, employeeCredentialId, ctx.organizationId]
        );

        await recordAuditLog(client, {
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: "credential.completion_date_corrected_from_document",
          entityType: "employee_credential",
          entityId: employeeCredentialId,
          affectedEmployeeId: employeeId,
          previousValue: { completion_date: current.completion_date },
          newValue: { completion_date: newDate },
        });
      } else {
        await client.query(
          `UPDATE employee_credentials SET
             expiration_date = $1, expiration_override = true,
             expiration_override_reason = 'Corrected from uploaded document (OCR)', updated_by = $2
           WHERE id = $3 AND organization_id = $4`,
          [newDate, ctx.userId, employeeCredentialId, ctx.organizationId]
        );

        await recordAuditLog(client, {
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: "credential.expiration_overridden",
          entityType: "employee_credential",
          entityId: employeeCredentialId,
          affectedEmployeeId: employeeId,
          previousValue: { expiration_date: current.expiration_date },
          newValue: { expiration_date: newDate, reason: "Corrected from uploaded document (OCR)" },
        });
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to apply the corrected date." };
  }

  revalidatePath(`/employees/${employeeId}/credentials/${credentialTypeId}/documents`);
  revalidatePath(`/employees/${employeeId}`);
  return { success: true };
}
