import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/session";
import { NewPositionForm } from "./NewPositionForm";

export default async function NewPositionPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Add Position</h1>
      <NewPositionForm />
    </div>
  );
}
