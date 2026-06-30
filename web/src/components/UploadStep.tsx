import { useRef, useState } from 'react';

/**
 * Step 1 — Upload (Presentation only). Takes a text-based PDF, sends the raw bytes to the backend,
 * and hands the extracted text upward. It owns only UI state (drag styling, the file's name, a
 * friendly error); all extraction logic lives on the server.
 */
export function UploadStep({ onLoaded }: { onLoaded: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: await file.arrayBuffer(),
      });
      const data = (await res.json()) as { text?: string; message?: string };
      if (!res.ok) {
        setError(data.message ?? 'That file could not be processed.');
        return;
      }
      onLoaded(data.text ?? '');
    } catch {
      setError('Could not reach the backend — is `npm run dev` running?');
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sample');
      const data = (await res.json()) as { text: string };
      onLoaded(data.text);
    } catch {
      setError('Could not load the sample document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
          dragging ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
        }`}
      >
        <p className="text-base font-medium text-slate-800">Drop a PDF here to begin</p>
        <p className="mt-1 text-sm text-slate-500">Text-based PDFs only. Nothing leaves your machine.</p>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {busy ? 'Reading…' : 'Choose PDF'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {error}
        </div>
      )}

      <p className="text-center text-sm text-slate-500">
        Don't have one handy?{' '}
        <button
          onClick={useSample}
          disabled={busy}
          className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-600 disabled:opacity-40"
        >
          Try the sample document
        </button>
      </p>
    </section>
  );
}
