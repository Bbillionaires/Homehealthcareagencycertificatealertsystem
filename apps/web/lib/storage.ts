import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Private document storage via a Railway bucket (S3-compatible object
 * storage) -- the direct replacement for Supabase Storage's private
 * buckets + signed URLs (see docs/ARCHITECTURE.md §1/§16). Bytes never
 * touch Postgres; credential_documents only stores the object key and
 * metadata, and every read goes through a short-lived presigned URL
 * generated here after the caller's own permission check.
 */

export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.RAILWAY_BUCKET_ENDPOINT &&
      process.env.RAILWAY_BUCKET_NAME &&
      process.env.RAILWAY_BUCKET_ACCESS_KEY_ID &&
      process.env.RAILWAY_BUCKET_SECRET_ACCESS_KEY
  );
}

function getBucketName(): string {
  const bucket = process.env.RAILWAY_BUCKET_NAME;
  if (!bucket) throw new Error("Document storage is not configured (RAILWAY_BUCKET_NAME missing).");
  return bucket;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  if (!isStorageConfigured()) {
    throw new Error("Document storage is not configured yet.");
  }

  cachedClient = new S3Client({
    endpoint: process.env.RAILWAY_BUCKET_ENDPOINT,
    region: process.env.RAILWAY_BUCKET_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.RAILWAY_BUCKET_ACCESS_KEY_ID!,
      secretAccessKey: process.env.RAILWAY_BUCKET_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

/** `credential-documents/{orgId}/{employeeId}/{employeeCredentialId}/{timestamp}-{safeFileName}` */
export function buildDocumentKey(
  organizationId: string,
  employeeId: string,
  employeeCredentialId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  return `credential-documents/${organizationId}/${employeeId}/${employeeCredentialId}/${Date.now()}-${safeFileName}`;
}

export async function uploadDocument(key: string, body: Buffer, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Short-lived (5 minute) signed URL -- generate fresh on every page render, never store or cache it. */
export async function getDocumentDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucketName(), Key: key }),
    { expiresIn: 300 }
  );
}
