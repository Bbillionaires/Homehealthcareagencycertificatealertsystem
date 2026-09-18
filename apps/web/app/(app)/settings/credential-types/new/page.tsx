import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { CredentialTypeForm } from "../CredentialTypeForm";
import { createCredentialTypeAction } from "../actions";

export default async function NewCredentialTypePage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Add Credential Type</h1>
      <CredentialTypeForm action={createCredentialTypeAction} submitLabel="Save Credential Type" isNew />
    </div>
  );
}
