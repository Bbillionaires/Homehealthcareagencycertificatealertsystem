import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { RequirementsForm } from "./RequirementsForm";

export default async function PositionRequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  const { position, credentialTypes, requirementsByType } = await withUserContext(ctx.userId, async (client) => {
    const [positionResult, credentialTypesResult, requirementsResult] = await Promise.all([
      client.query<{ id: string; name: string }>("SELECT id, name FROM positions WHERE id = $1 AND organization_id = $2", [
        id,
        ctx.organizationId,
      ]),
      client.query<{ id: string; name: string; category: string }>(
        "SELECT id, name, category FROM credential_types WHERE organization_id = $1 AND is_active ORDER BY sort_order, name",
        [ctx.organizationId]
      ),
      client.query<{ credential_type_id: string; is_required: boolean }>(
        "SELECT credential_type_id, is_required FROM position_requirements WHERE position_id = $1 AND organization_id = $2",
        [id, ctx.organizationId]
      ),
    ]);
    return {
      position: positionResult.rows[0] ?? null,
      credentialTypes: credentialTypesResult.rows,
      requirementsByType: new Map(requirementsResult.rows.map((r) => [r.credential_type_id, r.is_required])),
    };
  });

  if (!position) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Requirements: {position.name}</h1>
        <p className="text-sm text-slate-500">
          Choose whether each credential is required, optional, or not applicable for this position. New
          employees assigned to this position get this exact checklist.
        </p>
      </div>
      <RequirementsForm
        positionId={position.id}
        credentialTypes={credentialTypes}
        initialSelections={Object.fromEntries(
          credentialTypes.map((ct) => [
            ct.id,
            requirementsByType.has(ct.id) ? (requirementsByType.get(ct.id) ? "required" : "optional") : "not_applicable",
          ])
        )}
      />
    </div>
  );
}
