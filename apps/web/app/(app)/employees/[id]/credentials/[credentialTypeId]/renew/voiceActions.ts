"use server";

import { requireOrgContext } from "@/lib/session";
import { getVoiceFillProvider, type VoiceFieldSpec } from "@/lib/adapters/voiceFill";

export interface VoiceCredentialFields {
  completionDate?: string;
  issueDate?: string;
  certificateNumber?: string;
  issuingOrganization?: string;
  notes?: string;
}

export interface VoiceCredentialResult {
  transcript: string;
  fields: VoiceCredentialFields;
  error?: string;
}

const FIELD_SPECS: VoiceFieldSpec[] = [
  { name: "completionDate", description: "Completion date, as YYYY-MM-DD" },
  { name: "issueDate", description: "Issue date, as YYYY-MM-DD, if mentioned separately from completion" },
  { name: "certificateNumber", description: "Certificate/license number" },
  { name: "issuingOrganization", description: "The organization or provider that issued it" },
  { name: "notes", description: "Any other free-text notes" },
];

export async function voiceFillCredentialAction(formData: FormData): Promise<VoiceCredentialResult> {
  await requireOrgContext();
  const audio = formData.get("audio");
  const credentialTypeName = String(formData.get("credentialTypeName") ?? "");
  if (!(audio instanceof File) || audio.size === 0) {
    return { transcript: "", fields: {}, error: "No recording received." };
  }

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    const { transcript, fields } = await getVoiceFillProvider().fill(
      buffer,
      audio.type,
      FIELD_SPECS,
      credentialTypeName ? `This is a renewal record for the "${credentialTypeName}" credential.` : undefined
    );
    return { transcript, fields };
  } catch (err) {
    return { transcript: "", fields: {}, error: err instanceof Error ? err.message : "Couldn't process that recording." };
  }
}
