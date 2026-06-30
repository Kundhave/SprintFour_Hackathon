import type { Span, SpanStatus } from './types';

export type ExportResult = {
  /** The document exactly as the downstream AI will receive it. */
  text: string;
  /** How many spans were genuinely removed from the bytes. */
  redactedCount: number;
  /** How many detected spans remain visible (the count shown at the export gate). */
  visibleCount: number;
};

/** A span is removed from the export only when it is HIDDEN — never the reverse (CLAUDE.md §4). */
const REDACTED_STATUSES: ReadonlySet<SpanStatus> = new Set<SpanStatus>([
  'auto_redacted',
  'hidden_by_user',
  'user_added',
]);
const isRedacted = (status: SpanStatus): boolean => REDACTED_STATUSES.has(status);

/**
 * exportBuilder — produce genuinely clean output (CLAUDE.md §5, §3 Output integrity).
 *
 *   - A hidden span's raw text is REMOVED and replaced with a typed marker (`[REDACTED:PHONE]`),
 *     never just visually covered. After this runs, the raw PII is absent from the bytes.
 *   - PREVIEW and REAL EXPORT call THIS one function, so what Sam previews is what ships.
 *   - The function only ever hides; it never reveals a hidden span (the never-auto-expose invariant).
 *
 * Pure + I/O-free.
 */
export function buildExport(sourceText: string, spans: Span[]): ExportResult {
  const toRedact = spans
    .filter((span) => isRedacted(span.status))
    .sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  let redactedCount = 0;

  for (const span of toRedact) {
    if (span.start < cursor) continue; // an overlapping span was already redacted
    out += sourceText.slice(cursor, span.start);
    out += `[REDACTED:${span.type}]`;
    cursor = span.end;
    redactedCount += 1;
  }
  out += sourceText.slice(cursor);

  const visibleCount = spans.filter((span) => !isRedacted(span.status)).length;
  return { text: out, redactedCount, visibleCount };
}
