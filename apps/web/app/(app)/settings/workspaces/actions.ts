"use server";

import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { createWorkspace } from "@/lib/workspaces";
import { withUserContext } from "@/lib/db/context";
import { recordAuditLog } from "@/lib/audit";
import { INDUSTRIES, type IndustryKey } from "@compliance/shared";

export interface ActionResult {
  error?: string;
}

export async function addWorkspaceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    return { error: "Only an Owner can add industry workspaces." };
  }

  const industryKey = String(formData.get("industry") ?? "") as IndustryKey;
  const industry = INDUSTRIES.find((i) => i.key === industryKey);
  if (!industry) return { error: "Select an industry." };

  let workspaceSlug: string;
  try {
    const workspace = await createWorkspace({
      organizationId: ctx.organizationId,
      ownerUserId: ctx.userId,
      industry: industry.key,
    });
    workspaceSlug = workspace.slug;

    await withUserContext(ctx.userId, (client) =>
      recordAuditLog(client, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "workspace.created",
        entityType: "industry_workspace",
        entityId: workspace.id,
        newValue: { name: workspace.name, industry: industry.key },
      })
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add workspace." };
  }

  redirect(`/app/${workspaceSlug}/dashboard`);
}
