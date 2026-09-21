/**
 * Voice-to-form: someone records themselves speaking the values for a
 * form (an employee's info, a credential's dates, a position's name),
 * and this adapter turns that recording into a flat set of field values
 * the calling form can use to pre-fill its inputs for review before
 * saving -- it never submits anything itself. Same two-model pattern as
 * the contractor-os voice-quote adapter (Bbillionaires/constructionsoftware):
 * Whisper transcribes the audio, then a Llama instruct model extracts the
 * fields the caller asked for. Deliberately generic across every form
 * this app wires a mic button into, so adding voice to a new form is a
 * matter of describing its fields, not writing a new adapter.
 */

export interface VoiceFieldSpec {
  name: string;
  /** What this field means and its expected format, e.g. "Completion date, as YYYY-MM-DD". */
  description: string;
}

export interface VoiceFillResult {
  transcript: string;
  /** Only fields the speaker actually addressed are present; never guessed/invented. */
  fields: Record<string, string>;
}

export interface VoiceFillProvider {
  fill(audio: Buffer, mimeType: string, fields: VoiceFieldSpec[], context?: string): Promise<VoiceFillResult>;
}

class DevVoiceFillProvider implements VoiceFillProvider {
  async fill(_audio: Buffer, _mimeType: string, fields: VoiceFieldSpec[]): Promise<VoiceFillResult> {
    return {
      transcript:
        "[Development mode -- no CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN configured for QualifyStaff, " +
        "so this is a simulated transcript, not your real recording.]",
      fields: Object.fromEntries(fields.map((f) => [f.name, ""])),
    };
  }
}

function buildExtractionSystemPrompt(fields: VoiceFieldSpec[], context?: string): string {
  const fieldLines = fields.map((f) => `  "${f.name}": "${f.description}"`).join(",\n");
  return `You turn a spoken description into structured form field values.
${context ? `Context: ${context}\n` : ""}Read the transcript and output ONLY a single JSON object (no markdown, no commentary) with this exact shape:
{
${fieldLines}
}
Rules:
- Only include a field if the speaker actually said something that maps to it. Omit any field they didn't address -- never invent, guess, or default a value for something unsaid.
- Every date value must be output as a plain YYYY-MM-DD string, converting whatever the speaker said ("March 3rd twenty twenty-six", "next Tuesday" relative to today being ${new Date().toISOString().slice(0, 10)}, "03/03/2026") into that exact format.
- Keep every value exactly as spoken otherwise (names, numbers, free text) -- do not paraphrase or embellish.
- Never include any text outside the JSON object.`;
}

class CloudflareVoiceFillProvider implements VoiceFillProvider {
  constructor(
    private accountId: string,
    private apiToken: string
  ) {}

  private async run(model: string, body: BodyInit, contentType: string) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": contentType },
      body,
    });
    if (!res.ok) throw new Error(`Cloudflare Workers AI (${model}) failed: ${await res.text()}`);
    return res.json();
  }

  async fill(audio: Buffer, mimeType: string, fields: VoiceFieldSpec[], context?: string): Promise<VoiceFillResult> {
    const whisper = (await this.run(
      "@cf/openai/whisper-large-v3-turbo",
      new Uint8Array(audio),
      mimeType || "audio/webm"
    )) as { result: { text: string } };
    const transcript = whisper.result.text.trim();

    const llm = (await this.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      JSON.stringify({
        messages: [
          { role: "system", content: buildExtractionSystemPrompt(fields, context) },
          { role: "user", content: transcript },
        ],
      }),
      "application/json"
    )) as { result: { response?: string | object; choices?: { message?: { content?: string } }[] } };

    const rawContent =
      llm.result.choices?.[0]?.message?.content ??
      (typeof llm.result.response === "string" ? llm.result.response : JSON.stringify(llm.result.response ?? {}));

    return { transcript, fields: parseFieldResponse(rawContent, fields) };
  }
}

function parseFieldResponse(raw: string, fields: VoiceFieldSpec[]): Record<string, string> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const json = JSON.parse(match[0]) as Record<string, unknown>;
    const allowedNames = new Set(fields.map((f) => f.name));
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      if (!allowedNames.has(key)) continue;
      if (typeof value === "string" && value.trim()) result[key] = value.trim();
    }
    return result;
  } catch {
    return {};
  }
}

export function getVoiceFillProvider(): VoiceFillProvider {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
    return new CloudflareVoiceFillProvider(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN);
  }
  return new DevVoiceFillProvider();
}
