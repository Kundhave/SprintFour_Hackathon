import { useEffect, useState } from 'react';
import type {
  DocSegment,
  ExportMode,
  ExportResult,
  RemainingCategory,
  RemainingSpan,
  Span,
} from '../store/types';

/**
 * Steps 6 + 7 — Preview and Export (Presentation only; CLAUDE.md §3 Safety, D8). The one
 * irreversible moment, so it gets the most weight.
 *
 * It asks the backend to build the processed document (`/api/preview`) and renders the SAME
 * `segments` the PDF export will draw — semantic labels in anonymize mode, solid black boxes in
 * redact mode — so the preview accurately represents the file. "Export PDF" then calls
 * `/api/export`, which runs the identical builder and writes the bytes. The preview just didn't
 * write them.
 */
export function ExportGate({
  text,
  spans,
  mode,
  onClose,
}: {
  text: string;
  spans: Span[];
  mode: ExportMode;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, spans, mode }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ExportResult>;
      })
      .then((data) => live && setResult(data))
      .catch(() => live && setError('Could not build the preview — is the backend running?'));
    return () => {
      live = false;
    };
  }, [text, spans, mode]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  /** Confirm = render the SAME segments to a PDF on the server and download it. */
  async function exportPdf() {
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, spans, mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed-${mode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError('The export could not be generated.');
    } finally {
      setExporting(false);
    }
  }

  const isEmptyDoc = text.trim().length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Export preview"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Preview before export</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            This is the document exactly as it will be exported in{' '}
            <span className="font-medium">{mode === 'redact' ? 'redaction' : 'anonymize'}</span>{' '}
            mode. Nothing leaves your machine until you confirm.
          </p>
        </header>

        {error && (
          <div className="m-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {!error && !result && (
          <p className="px-6 py-10 text-center text-sm text-slate-400">Building the preview…</p>
        )}

        {result && (
          <>
            <CountBanner result={result} />
            <div className="overflow-y-auto px-6 py-4">
              {isEmptyDoc ? (
                <p className="rounded-lg bg-slate-50 px-4 py-10 text-center text-sm text-slate-400 ring-1 ring-slate-200">
                  This document is empty — there's nothing to export.
                </p>
              ) : (
                <Preview result={result} />
              )}
            </div>
          </>
        )}

        <footer className="mt-auto flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Back
          </button>
          <button
            onClick={exportPdf}
            disabled={!result || !!error || exporting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** The count — the felt-accountability number (D8). Green when the export is fully clean. */
function CountBanner({ result }: { result: ExportResult }) {
  const clean = result.visibleCount === 0;
  return (
    <div
      className={`mx-6 mt-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 ${
        clean ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${
          clean ? 'bg-emerald-600' : 'bg-amber-500'
        }`}
      >
        {result.visibleCount}
      </span>
      <div>
        <p className="font-medium">{result.summary}</p>
        <p className="mt-0.5 text-xs opacity-80">
          {result.redactedCount} item{result.redactedCount === 1 ? '' : 's'} removed from the
          document — highlighted text below is still legible.
        </p>
      </div>
    </div>
  );
}

/**
 * Render the processed document from `segments`, exactly as the PDF will draw it:
 *   - kept text is shown verbatim, with any still-legible PII highlighted by WHY it remains;
 *   - a removed run is shown as its [LABEL] (anonymize) or as a solid black box (redact).
 * Offsets in `remaining` index the OUTPUT text, so we track output position across segments to line
 * the highlights up with the kept runs. (The black boxes here are display only — the real export's
 * boxes are drawn into the PDF content, not faked with CSS.)
 */
function Preview({ result }: { result: ExportResult }) {
  let outPos = 0;
  const nodes: React.ReactNode[] = [];

  result.segments.forEach((segment, i) => {
    if (segment.kind === 'redacted') {
      nodes.push(<RemovedRun key={i} mode={result.mode} segment={segment} />);
      outPos += markerLength(segment, result.mode);
      return;
    }
    nodes.push(
      <KeptRun key={i} text={segment.text} base={outPos} remaining={result.remaining} />,
    );
    outPos += segment.text.length;
  });

  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-800 ring-1 ring-slate-200">
      {nodes}
    </pre>
  );
}

/** Length this segment occupies in the OUTPUT text — mirrors the server's marker() exactly. */
function markerLength(segment: Extract<DocSegment, { kind: 'redacted' }>, mode: ExportMode): number {
  return mode === 'anonymize' ? `[${segment.type}]`.length : segment.length;
}

function RemovedRun({
  segment,
  mode,
}: {
  segment: Extract<DocSegment, { kind: 'redacted' }>;
  mode: ExportMode;
}) {
  if (mode === 'anonymize') {
    return (
      <span className="rounded bg-slate-200 px-1 font-medium text-slate-700">[{segment.type}]</span>
    );
  }
  // Solid box sized to the removed length (monospace → 1ch ≈ one original character).
  return (
    <span
      title="redacted"
      className="inline-block translate-y-[2px] rounded-[2px] bg-slate-900 align-baseline"
      style={{ width: `${segment.length}ch`, height: '1em' }}
    />
  );
}

/** Kept text with still-legible PII highlighted, coloured by why it remains. */
function KeptRun({
  text,
  base,
  remaining,
}: {
  text: string;
  base: number;
  remaining: RemainingSpan[];
}) {
  const here = remaining
    .filter((r) => r.start >= base && r.start < base + text.length)
    .sort((a, b) => a.start - b.start);

  if (here.length === 0) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  here.forEach((r, i) => {
    const s = Math.max(cursor, r.start - base);
    const e = Math.min(text.length, r.end - base);
    if (s > cursor) parts.push(<span key={`p${i}`}>{text.slice(cursor, s)}</span>);
    if (e > s)
      parts.push(
        <mark key={`m${i}`} title={r.reason} className={`rounded px-0.5 font-medium ${STYLE[r.category]}`}>
          {text.slice(s, e)}
        </mark>,
      );
    cursor = Math.max(cursor, e);
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

const STYLE: Record<RemainingCategory, string> = {
  undecided: 'bg-red-200 text-red-900',
  reversed_auto: 'bg-rose-200 text-rose-900',
  kept: 'bg-emerald-200 text-emerald-900',
  left_visible: 'bg-yellow-200 text-yellow-900',
};
