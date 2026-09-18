"use server";

import { revalidatePath } from "next/cache";
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

export interface UploadResult {
  error?: string;
  success?: boolean;
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

  try {
    await withUserContext(ctx.userId, async (client) => {
      const activeResult = await client.query<{ id: string }>(
        `SELECT id FROM employee_credentials
         WHERE employee_id = $1 AND credential_type_id = $2 AND organization_id = $3 AND status = 'active'`,
        [employeeId, credentialTypeId, ctx.organizationId]
      );
      const active = activeResult.rows[0];
      if (!active) {
        throw new Error("Add a completion date for this credential before attaching a document.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
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
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to upload document." };
  }

  revalidatePath(`/employees/${employeeId}/credentials/${credentialTypeId}/documents`);
  return { success: true };
}
