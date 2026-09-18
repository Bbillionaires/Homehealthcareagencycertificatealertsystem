"use server";

import { redirect } from "next/navigation";
import { addCalendarInterval, credentialRenewalSchema } from "@compliance/shared";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/session";

export interface ActionResult {
  error?: string;
}

export async function renewCredentialAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner" && ctx.role !== "office_manager") {
    return { error: "You don't have permission to renew credentials." };
  }

  const parsed = credentialRenewalSchema.safeParse({
    employeeId: formData.get("employeeId"),
    credentialTypeId: formData.get("credentialTypeId"),
    completionDate: formData.get("completionDate"),
    issueDate: formData.get("issueDate") || undefined,
    certificateNumber: formData.get("certificateNumber") ?? "",
    issuingOrganization: formData.get("issuingOrganization") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data: credentialType, error: ctError } = await supabase
    .from("credential_types")
    .select("renewal_interval_value, renewal_interval_unit")
    .eq("id", input.credentialTypeId)
    .eq("organization_id", ctx.organizationId)
    .single();

  if (ctError || !credentialType) {
    return { error: "Credential type not found." };
  }

  const expirationDate =
    credentialType.renewal_interval_value && credentialType.renewal_interval_unit
      ? addCalendarInterval(input.completionDate, credentialType.renewal_interval_value, credentialType.renewal_interval_unit)
      : null;

  const { error } = await supabase.rpc("renew_employee_credential", {
    p_employee_id: input.employeeId,
    p_credential_type_id: input.credentialTypeId,
    p_completion_date: input.completionDate,
    p_issue_date: input.issueDate ?? null,
    p_expiration_date: expirationDate,
    p_certificate_number: input.certificateNumber ?? null,
    p_issuing_organization: input.issuingOrganization ?? null,
    p_notes: input.notes ?? null,
    p_actor_user_id: ctx.userId,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(`/employees/${input.employeeId}`);
}
