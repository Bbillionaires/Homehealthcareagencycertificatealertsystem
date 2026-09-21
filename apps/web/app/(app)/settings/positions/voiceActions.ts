"use server";

import { requireOrgContext } from "@/lib/session";
import { getVoiceFillProvider, type VoiceFieldSpec } from "@/lib/adapters/voiceFill";

export interface VoicePositionFields {
  name?: string;
  description?: string;
}

export interface VoicePositionResult {
  transcript: string;
  fields: VoicePositionFields;
  error?: string;
}

const FIELD_SPECS: VoiceFieldSpec[] = [
  { name: "name", description: "The position/job title" },
  { name: "description", description: "A short description of the role" },
];

export async function voiceFillPositionAction(formData: FormData): Promise<VoicePositionResult> {
  await requireOrgContext();
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { transcript: "", fields: {}, error: "No recording received." };
  }

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    const { transcript, fields } = await getVoiceFillProvider().fill(buffer, audio.type, FIELD_SPECS);
    return { transcript, fields };
  } catch (err) {
    return { transcript: "", fields: {}, error: err instanceof Error ? err.message : "Couldn't process that recording." };
  }
}
