/**
 * OCR date cross-check: after a certificate/document is uploaded, read
 * whatever dates are printed on it and hand them back so the caller can
 * compare against the dates a human typed in -- confirming they match, or
 * flagging a mismatch with the option to accept the document's date
 * instead. This never types a date on anyone's behalf; it only checks the
 * typed date against what the document actually shows. Uses a vision
 * model on Cloudflare Workers AI, the same provider (and cost profile) as
 * the voiceFill adapter and the contractor-os voice-quote feature.
 */

export interface ExtractedDate {
  /** What this date appears to be, in the document's own words (e.g. "Issued", "Expires"). */
  label: string;
  /** YYYY-MM-DD, or null if a date-like label was found but the date itself was illegible. */
  date: string | null;
}

export interface DocumentDateResult {
  /** True once a real scan ran; false in dev mode (no dates were actually read). */
  scanned: boolean;
  dates: ExtractedDate[];
}

export interface DocumentDateProvider {
  extractDates(image: Buffer, mimeType: string): Promise<DocumentDateResult>;
}

class DevDocumentDateProvider implements DocumentDateProvider {
  async extractDates(): Promise<DocumentDateResult> {
    return { scanned: false, dates: [] };
  }
}

const EXTRACTION_PROMPT = `You are reading a scanned certificate, license, or training document. Find every printed date on it (issue date, completion date, effective date, expiration/expiry date, renewal date -- whatever labels appear) and output ONLY a single JSON object, no markdown or commentary, in this exact shape:
{
  "dates": [
    { "label": "<the date's label as printed, or your best short description if unlabeled>", "date": "<YYYY-MM-DD, or null if you can see a date is there but can't read it clearly>" }
  ]
}
If the document has no readable dates at all, return {"dates": []}. Never invent a date that isn't actually printed on the document.`;

class CloudflareDocumentDateProvider implements DocumentDateProvider {
  constructor(
    private accountId: string,
    private apiToken: string
  ) {}

  async extractDates(image: Buffer, mimeType: string): Promise<DocumentDateResult> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: EXTRACTION_PROMPT }],
          image: Array.from(image),
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Cloudflare Workers AI (vision) failed: ${await res.text()}`);
    }
    const json = (await res.json()) as { result: { response?: string } };
    return { scanned: true, dates: parseDatesResponse(json.result.response ?? "") };
  }
}

function parseDatesResponse(raw: string): ExtractedDate[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const json = JSON.parse(match[0]) as { dates?: unknown };
    if (!Array.isArray(json.dates)) return [];
    return json.dates
      .filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null)
      .map((d) => ({
        label: typeof d.label === "string" && d.label.trim() ? d.label.trim() : "Date",
        date: typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
      }));
  } catch {
    return [];
  }
}

/** Vision models here only take images; PDFs aren't rasterized yet, so those are skipped by the caller. */
export const OCR_SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png"];

export function getDocumentDateProvider(): DocumentDateProvider {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
    return new CloudflareDocumentDateProvider(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN);
  }
  return new DevDocumentDateProvider();
}
