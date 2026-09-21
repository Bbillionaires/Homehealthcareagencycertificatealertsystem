"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * Generic mic-recording control: record, stop, hand the audio Blob to
 * whatever the caller wants done with it. It owns none of the
 * form-specific extraction logic -- that lives in each page's own server
 * action -- so adding voice input to a new form means passing a new
 * `onAudioReady`, never touching this component.
 */
export function VoiceCaptureButton({
  onAudioReady,
  label = "Fill by voice",
}: {
  onAudioReady: (blob: Blob) => Promise<void>;
  label?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setProcessing(true);
        try {
          await onAudioReady(blob);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't process that recording.");
        } finally {
          setProcessing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone -- check your browser's permission for this site.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex items-center gap-2">
      {!recording ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={processing}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="mic" className="h-4 w-4" />
          {processing ? "Filling in..." : label}
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          <Icon name="stop-circle" className="h-4 w-4" />
          Stop recording
        </button>
      )}
      {recording && <span className="text-xs text-slate-500">Listening...</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
