import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { CredentialTypeForm, type CredentialTypeFormValues } from "../../CredentialTypeForm";
import { updateCredentialTypeAction } from "../../actions";

export default async function EditCredentialTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const credentialType = await withUserContext(ctx.userId, async (client) => {
    const result = await client.query<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      category: string;
      renewal_interval_value: number | null;
      renewal_interval_unit: string | null;
      requires_document: boolean;
      is_required_default: boolean;
      warning_yellow_threshold_days: number | null;
      warning_orange_threshold_days: number | null;
      is_active: boolean;
    }>(
      `SELECT id, key, name, description, category, renewal_interval_value, renewal_interval_unit,
              requires_document, is_required_default, warning_yellow_threshold_days,
              warning_orange_threshold_days, is_active
       FROM credential_types WHERE id = $1 AND organization_id = $2`,
      [id, ctx.organizationId]
    );
    return result.rows[0] ?? null;
  });

  if (!credentialType) notFound();

  const defaultValues: CredentialTypeFormValues = {
    id: credentialType.id,
    key: credentialType.key,
    name: credentialType.name,
    description: credentialType.description ?? "",
    category: credentialType.category,
    renewalIntervalValue: credentialType.renewal_interval_value,
    renewalIntervalUnit: credentialType.renewal_interval_unit,
    requiresDocument: credentialType.requires_document,
    isRequiredDefault: credentialType.is_required_default,
    warningYellowThresholdDays: credentialType.warning_yellow_threshold_days,
    warningOrangeThresholdDays: credentialType.warning_orange_threshold_days,
    isActive: credentialType.is_active,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Edit {credentialType.name}</h1>
      <CredentialTypeForm
        action={updateCredentialTypeAction}
        defaultValues={defaultValues}
        submitLabel="Save Changes"
        isNew={false}
      />
    </div>
  );
}
