"use client";

import { usePathname, useRouter } from "next/navigation";
import type { WorkspaceSummary } from "@/lib/workspaces";

/**
 * Reads the current workspace slug from the URL itself
 * (usePathname works regardless of layout nesting, unlike a layout's
 * `params` prop, which only sees segments at or above where it's
 * mounted -- this switcher lives in the shared (app) layout, above
 * app/[workspaceSlug]/...) rather than being told it via a prop.
 */
export function WorkspaceSwitcher({ workspaces, canAddWorkspace }: { workspaces: WorkspaceSummary[]; canAddWorkspace: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const match = pathname.match(/^\/app\/([^/]+)\//);
  const currentSlug = match ? match[1] : null;

  if (workspaces.length === 0) return null;

  return (
    <div className="border-b border-slate-200 p-3">
      <label htmlFor="workspace-switcher" className="block text-xs font-medium uppercase tracking-wide text-slate-400">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        value={currentSlug ?? "__all__"}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "__all__") {
            router.push("/dashboard");
          } else if (value === "__add__") {
            router.push("/settings/workspaces");
          } else {
            router.push(`/app/${value}/dashboard`);
          }
        }}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.slug}>
            {w.name}
          </option>
        ))}
        <option value="__all__">All Workspaces</option>
        {canAddWorkspace && <option value="__add__">+ Add Workspace</option>}
      </select>
    </div>
  );
}
