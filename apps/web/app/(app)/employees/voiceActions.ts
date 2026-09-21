"use server";

import { requireOrgContext } from "@/lib/session";
import { withUserContext } from "@/lib/db/context";
import { getVoiceFillProvider, type VoiceFieldSpec } from "@/lib/adapters/voiceFill";
import { fuzzyMatchOption } from "@/lib/adapters/fuzzyMatch";

export interface VoiceEmployeeFields {
  employeeNumber?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  dateOfHire?: string;
  phone?: string;
  email?: string;
  notes?: string;
  employmentStatus?: string;
  positionId?: string;
  positionName?: string;
  departmentId?: string;
  departmentName?: string;
}

export interface VoiceEmployeeResult {
  transcript: string;
  fields: VoiceEmployeeFields;
  error?: string;
}

const FIELD_SPECS: VoiceFieldSpec[] = [
  { name: "employeeNumber", description: "Employee ID / staff number" },
  { name: "firstName", description: "First name" },
  { name: "middleName", description: "Middle name" },
  { name: "lastName", description: "Last name" },
  { name: "preferredName", description: "Preferred name / nickname, if mentioned" },
  { name: "dateOfHire", description: "Date of hire, as YYYY-MM-DD" },
  { name: "phone", description: "Phone number" },
  { name: "email", description: "Email address" },
  { name: "employmentStatus", description: "One of: active, leave, inactive, terminated" },
  { name: "positionName", description: "The job position/title mentioned, verbatim as spoken" },
  { name: "departmentName", description: "The department mentioned, verbatim as spoken" },
  { name: "notes", description: "Any other free-text notes about the employee" },
];

export async function voiceFillEmployeeAction(formData: FormData): Promise<VoiceEmployeeResult> {
  const ctx = await requireOrgContext();
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { transcript: "", fields: {}, error: "No recording received." };
  }

  const { positions, departments } = await withUserContext(ctx.userId, async (client) => {
    const [positionsResult, departmentsResult] = await Promise.all([
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM positions WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
      client.query<{ id: string; name: string }>(
        "SELECT id, name FROM departments WHERE organization_id = $1 ORDER BY name",
        [ctx.organizationId]
      ),
    ]);
    return { positions: positionsResult.rows, departments: departmentsResult.rows };
  });

  const context =
    (positions.length ? `Known positions: ${positions.map((p) => p.name).join(", ")}. ` : "") +
    (departments.length ? `Known departments: ${departments.map((d) => d.name).join(", ")}.` : "");

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    const { transcript, fields: raw } = await getVoiceFillProvider().fill(
      buffer,
      audio.type,
      FIELD_SPECS,
      context || undefined
    );

    const fields: VoiceEmployeeFields = { ...raw };
    if (raw.positionName) {
      const match = fuzzyMatchOption(raw.positionName, positions);
      if (match) fields.positionId = match.id;
    }
    if (raw.departmentName) {
      const match = fuzzyMatchOption(raw.departmentName, departments);
      if (match) fields.departmentId = match.id;
    }

    return { transcript, fields };
  } catch (err) {
    return { transcript: "", fields: {}, error: err instanceof Error ? err.message : "Couldn't process that recording." };
  }
}
