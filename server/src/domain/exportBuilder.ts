import type { Span } from './types';

export type ExportResult = {
  /** The document exactly as the downstream AI will receive it. */
  text: string;
  /** How many spans were genuinely removed from the bytes. */
  redactedCount: number;
  /** How many spans remain visible (the count shown at the export gate). */
  visibleCount: number;
};

/**
 * exportBuilder — produce genuinely clean output (CLAUDE.md §5, §3 Output integrity).
 *
 * Contract (to implement):
 *   - Redacted PII is genuinely REMOVED from the output bytes, never just visually covered.
 *   - PREVIEW and REAL EXPORT share THIS ONE code path, so what Sam previews is what ships.
 *   - Export-integrity invariant: for any redacted span, its raw text must NOT appear in `text`.
 *
 * Pure + I/O-free.
 *
 * NOTE: structure only — no logic implemented yet.
 */
export function buildExport(sourceText: string, spans: Span[]): ExportResult {
  // TODO: remove redacted spans from sourceText; count redacted vs. still-visible.
  return { text: sourceText, redactedCount: 0, visibleCount: spans.length };
}
