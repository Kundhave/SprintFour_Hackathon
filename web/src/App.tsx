import { useEffect, useState } from 'react';

/**
 * App shell (Presentation layer — CLAUDE.md §5). Renders state; contains NO product logic.
 *
 * The thinnest end-to-end slice of the thesis: it loads the sample document, asks the backend to
 * run the pipeline, and shows the document with the auto-redactions ALREADY APPLIED — the structured
 * PII is gone, replaced by typed markers, not visually covered. The Export button downloads exactly
 * that text, so what you see is what ships (preview and export share one code path on the server).
 */

type ExportResult = { text: string; redactedCount: number; visibleCount: number };
type DetectResponse = { spans: unknown[]; export: ExportResult };

export default function App() {
  const [result, setResult] = useState<DetectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}', // no text → the server runs the canonical sample document
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DetectResponse>;
      })
      .then(setResult)
      .catch(() => setError('Could not reach the backend — is `npm run dev` running?'));
  }, []);

  function handleExport() {
    if (!result) return;
    const blob = new Blob([result.export.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redacted.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const redactedCount = result?.export.redactedCount ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conseal Review</h1>
            <p className="mt-1 text-sm text-slate-600">
              Structured PII was auto-redacted with certainty and genuinely removed from the text —
              not visually covered.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!result}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Export clean text
          </button>
        </header>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {!error && !result && <p className="mt-6 text-sm text-slate-500">Running detection…</p>}

        {result && (
          <>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              {redactedCount} item{redactedCount === 1 ? '' : 's'} auto-redacted
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-white p-6 font-mono text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200">
              {result.export.text}
            </pre>
          </>
        )}
      </div>
    </main>
  );
}
