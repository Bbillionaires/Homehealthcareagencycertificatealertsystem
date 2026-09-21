"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { renewCredentialAction, type ActionResult } from "./actions";
import { voiceFillCredentialAction } from "./voiceActions";
import { VoiceCaptureButton } from "@/components/VoiceCaptureButton";

const initialState: ActionResult = {};

export function RenewCredentialForm({
  employeeId,
  credentialTypeId,
  credentialTypeName,
  requiresDocument,
}: {
  employeeId: string;
  credentialTypeId: string;
  credentialTypeName: string;
  requiresDocument: boolean;
}) {
  const [state, formAction] = useFormState(renewCredentialAction, initialState);
  const [completionDate, setCompletionDate] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [issuingOrganization, setIssuingOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);

  async function handleVoiceRecording(blob: Blob) {
    const formData = new FormData();
    formData.set("audio", blob, "recording.webm");
    formData.set("credentialTypeName", credentialTypeName);
    const result = await voiceFillCredentialAction(formData);
    if (result.error) throw new Error(result.error);
    setTranscript(result.transcript);
    const { fields } = result;
    if (fields.completionDate) setCompletionDate(fields.completionDate);
    if (fields.issueDate) setIssueDate(fields.issueDate);
    if (fields.certificateNumber) setCertificateNumber(fields.certificateNumber);
    if (fields.issuingOrganization) setIssuingOrganization(fields.issuingOrganization);
    if (fields.notes) setNotes(fields.notes);
  }

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="credentialTypeId" value={credentialTypeId} />

      <div className="rounded-md bg-slate-50 p-3">
        <VoiceCaptureButton onAudioReady={handleVoiceRecording} label="Fill this form by voice" />
        {transcript && <p className="mt-2 text-xs text-slate-500">Heard: &ldquo;{transcript}&rdquo;</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="completionDate" className="block text-sm font-medium text-slate-700">
            Completion Date
          </label>
          <input
            id="completionDate"
            name="completionDate"
            type="date"
            required
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-slate-400">Expiration is calculated automatically from this date.</p>
        </div>
        <div>
          <label htmlFor="issueDate" className="block text-sm font-medium text-slate-700">
            Issue Date (optional)
          </label>
          <input
            id="issueDate"
            name="issueDate"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="certificateNumber" className="block text-sm font-medium text-slate-700">
            Certificate Number
          </label>
          <input
            id="certificateNumber"
            name="certificateNumber"
            type="text"
            value={certificateNumber}
            onChange={(e) => setCertificateNumber(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="issuingOrganization" className="block text-sm font-medium text-slate-700">
            Issuing Organization / Provider
          </label>
          <input
            id="issuingOrganization"
            name="issuingOrganization"
            type="text"
            value={issuingOrganization}
            onChange={(e) => setIssuingOrganization(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {requiresDocument && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This credential requires a document. Save the dates here first, then use the &ldquo;Documents&rdquo; link on the employee&apos;s profile to upload the certificate (or a photo of it) — admins and the employee can both download it later.
        </p>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Save Renewal
      </button>
    </form>
  );
}
