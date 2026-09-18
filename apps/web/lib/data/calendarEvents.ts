import type { ComplianceColor, CredentialStatusKey, StatusPresentation } from "@compliance/shared";
import { getOrgComplianceRoster } from "./compliance";

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  credentialTypeId: string;
  credentialTypeName: string;
  status: CredentialStatusKey;
  color: ComplianceColor;
  icon: StatusPresentation["icon"];
  label: string;
}

/** Every dated credential expiration across the org's active roster, one event per credential per employee. */
export async function getCalendarEvents(userId: string, organizationId: string): Promise<CalendarEvent[]> {
  const roster = await getOrgComplianceRoster(userId, organizationId);

  const events: CalendarEvent[] = [];
  for (const employee of roster) {
    for (const result of employee.compliance.results) {
      if (!result.expirationDate) continue;
      events.push({
        date: result.expirationDate,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        credentialTypeId: result.credentialTypeId,
        credentialTypeName: result.credentialTypeName,
        status: result.status,
        color: result.color,
        icon: result.icon,
        label: result.label,
      });
    }
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
