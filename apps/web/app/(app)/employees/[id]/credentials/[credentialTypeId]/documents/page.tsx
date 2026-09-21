import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { isStorageConfigured, getDocumentDownloadUrl } from "@/lib/storage";
import { formatDateLong } from "@compliance/shared";
import { UploadDocumentForm } from "./UploadDocumentForm";

interface DocumentRow {
  id: string;
  employee_credential_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  is_current: boolean;
  uploaded_at: Date;
  uploaded_by_name: string | null;
  credential_status: "active" | "archived";
}

export default async function CredentialDocumentsPage({
  params,
}: {
  params: Promise<{ id: string; credentialTypeId: string }>;
}) {
  const { id, credentialTypeId } = await params;
  const ctx = await requireOrgContext();

  const isAdmin = ctx.role === "owner" || ctx.role === "office_manager";
  const isSelf = ctx.role === "employee" && ctx.employeeId === id;
  if (!isAdmin && !isSelf) {
    redirect("/dashboard");
  }

  const { employee, credentialType, documents, activeRecord } = await withUserContext(ctx.userId, async (client) => {
    const [employeeResult, credentialTypeResult, documentsResult] = await Promise.all([
      client.query<{ id: string; first_name: string; last_name: string }>(
        "SELECT id, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2",
        [id, ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM credential_types WHERE id = $1 AND organization_id = $2",
        [credentialTypeId, ctx.organizationId]
      ),
      client.query<DocumentRow>(
        `SELECT cd.id, cd.employee_credential_id, cd.storage_path, cd.file_name, cd.mime_type, cd.size_bytes,
                cd.is_current, cd.uploaded_at, u.full_name AS uploaded_by_name, ec.status AS credential_status
         FROM credential_documents cd
         JOIN employee_credentials ec ON ec.id = cd.employee_credential_id
         LEFT JOIN users u ON u.id = cd.uploaded_by
         WHERE ec.employee_id = $1 AND ec.credential_type_id = $2 AND ec.organization_id = $3
         ORDER BY cd.uploaded_at DESC`,
        [id, credentialTypeId, ctx.organizationId]
      ),
    ]);

    const activeCheck = await client.query<{ id: string; completion_date: string | null; expiration_date: string | null }>(
      `SELECT id, completion_date, expiration_date FROM employee_credentials
       WHERE employee_id = $1 AND credential_type_id = $2 AND organization_id = $3 AND status = 'active'`,
      [id, credentialTypeId, ctx.organizationId]
    );

    return {
      employee: employeeResult.rows[0] ?? null,
      credentialType: credentialTypeResult.rows[0] ?? null,
      documents: documentsResult.rows,
      activeRecord: activeCheck.rows[0] ?? null,
    };
  });

  if (!employee || !credentialType) notFound();

  const storageConfigured = isStorageConfigured();
  const current = documents.filter((d) => d.credential_status === "active" && d.is_current);
  const history = documents.filter((d) => !(d.credential_status === "active" && d.is_current));

  const currentWithUrls = storageConfigured
    ? await Promise.all(current.map(async (d) => ({ ...d, url: await getDocumentDownloadUrl(d.storage_path) })))
    : current.map((d) => ({ ...d, url: null as string | null }));
  const historyWithUrls = storageConfigured
    ? await Promise.all(history.map(async (d) => ({ ...d, url: await getDocumentDownloadUrl(d.storage_path) })))
    : history.map((d) => ({ ...d, url: null as string | null }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Documents: {credentialType.name}</h1>
        <p className="text-sm text-slate-500">
          {employee.first_name} {employee.last_name}
        </p>
      </div>

      {!storageConfigured && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Document storage isn&apos;t configured for this environment yet (RAILWAY_BUCKET_* environment variables).
          Uploads are disabled until a bucket is connected; existing records will show below without a working
          download link.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Current Document</h2>
        </div>
        {currentWithUrls.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No document on file for the current record.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {currentWithUrls.map((doc) => (
              <DocumentRowView key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Document History</h2>
        </div>
        {historyWithUrls.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No prior documents.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historyWithUrls.map((doc) => (
              <DocumentRowView key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </section>

      {activeRecord ? (
        <UploadDocumentForm
          employeeId={id}
          credentialTypeId={credentialTypeId}
          employeeCredentialId={activeRecord.id}
          currentCompletionDate={activeRecord.completion_date}
          currentExpirationDate={activeRecord.expiration_date}
          disabled={!storageConfigured}
        />
      ) : (
        <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Add a completion date for this credential (Renew/Add on the employee&apos;s profile) before attaching a
          document.
        </p>
      )}
    </div>
  );
}

function DocumentRowView({
  doc,
}: {
  doc: DocumentRow & { url: string | null };
}) {
  return (
    <li className="flex items-center justify-between px-5 py-3">
      <div>
        {doc.url ? (
          <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
            {doc.file_name}
          </a>
        ) : (
          <span className="text-sm font-medium text-slate-500">{doc.file_name}</span>
        )}
        <p className="text-xs text-slate-500">
          {(doc.size_bytes / 1024).toFixed(0)} KB · uploaded {formatDateLong(doc.uploaded_at.toISOString().slice(0, 10))}
          {doc.uploaded_by_name ? ` by ${doc.uploaded_by_name}` : ""}
        </p>
      </div>
      {doc.credential_status === "archived" && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Archived</span>
      )}
    </li>
  );
}
