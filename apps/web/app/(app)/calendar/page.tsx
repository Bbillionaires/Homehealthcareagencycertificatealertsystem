import { requireOrgContext } from "@/lib/session";
import { PhaseStub } from "@/components/PhaseStub";

export default async function CalendarPage() {
  await requireOrgContext();
  return (
    <PhaseStub
      title="Compliance Calendar"
      phase="Phase 5"
      description="A day/week/month calendar of upcoming expirations, color-coded by status, is planned once the dashboard phase lands."
    />
  );
}
