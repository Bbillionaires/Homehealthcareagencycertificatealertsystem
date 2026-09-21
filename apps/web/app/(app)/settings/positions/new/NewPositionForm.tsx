"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createPositionAction, type ActionResult } from "../actions";
import { voiceFillPositionAction } from "../voiceActions";
import { VoiceCaptureButton } from "@/components/VoiceCaptureButton";

const initialState: ActionResult = {};

export function NewPositionForm() {
  const [state, formAction] = useFormState(createPositionAction, initialState);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);

  async function handleVoiceRecording(blob: Blob) {
    const formData = new FormData();
    formData.set("audio", blob, "recording.webm");
    const result = await voiceFillPositionAction(formData);
    if (result.error) throw new Error(result.error);
    setTranscript(result.transcript);
    if (result.fields.name) setName(result.fields.name);
    if (result.fields.description) setDescription(result.fields.description);
  }

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div className="rounded-md bg-slate-50 p-3">
        <VoiceCaptureButton onAudioReady={handleVoiceRecording} label="Fill this form by voice" />
        {transcript && <p className="mt-2 text-xs text-slate-500">Heard: &ldquo;{transcript}&rdquo;</p>}
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Position Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Save Position
      </button>
    </form>
  );
}
