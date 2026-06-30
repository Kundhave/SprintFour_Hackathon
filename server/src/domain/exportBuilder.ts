import type { Span, SpanStatus } from './types';

/**
 * How the user wants the processed document to read (CLAUDE.md §3 output integrity, D8/D9).
 *  - 'anonymize' — replace each redacted span with its semantic label, e.g. [NAME], [EMAIL].
 *                  Prioritises readability for a downstream reader/AI.
 *  - 'redact'    — remove the span entirely; the renderer draws a solid box in its place.
 * The mode changes only how a removed span is REPRESENTED — never which spans are removed (that is
 * the router's job, unchanged). So the never-auto-expose routing philosophy is untouched.
 */
export type ExportMode = 'anonymize' | 'redact';

/**
 * A pure, render-agnostic description of the processed document. The web preview and the PDF
 * exporter both consume THIS — so what is previewed is provably what ships (D8). A redacted segment
 * carries only its type and original LENGTH, never the original bytes, so raw PII for a redacted
 * span cannot survive into any renderer (D9).
 */
export type DocSegment =
  | { kind: 'kept'; text: string }
  | { kind: 'redacted'; type: string; length: number };

/** Why a detected PII span will still be legible in the export. */
export type RemainingCategory = 'kept' | 'undecided' | 'left_visible' | 'reversed_auto';

/** A piece of PII that remains legible in the export, with offsets into the OUTPUT text. */
export type RemainingSpan = {
  type: string;
  text: string;
  start: number;
  end: number;
  category: RemainingCategory;
  reason: string;
};

export type ExportResult = {
  /** Which representation was applied. */
  mode: ExportMode;
  /** The processed document as a flat string (markers applied) — exactly what a text export holds. */
  text: string;
  /** The processed document as structured segments — what the preview and PDF renderer consume. */
  segments: DocSegment[];
  /** How many spans were genuinely removed from the content. */
  redactedCount: number;
  /** How many detected PII spans remain legible (the count shown at the export gate). */
  visibleCount: number;
  /** Each still-legible PII span, located in the OUTPUT text and labelled with why it remains. */
  remaining: RemainingSpan[];
  /**
   * One human-readable sentence for the export gate — e.g. "3 items will remain visible: a name you
   * kept, and 2 things nothing flagged." Computed here so it rides the ONE code path: preview and
   * real export show the identical sentence (D8). Presentation just renders it (CLAUDE.md §5).
   */
  summary: string;
};

/** A span is removed from the export only when it is HIDDEN — never the reverse (CLAUDE.md §4). */
const REDACTED_STATUSES: ReadonlySet<SpanStatus> = new Set<SpanStatus>([
  'auto_redacted',
  'hidden_by_user',
  'user_added',
]);
const isRedacted = (status: SpanStatus): boolean => REDACTED_STATUSES.has(status);

/** The flat-text marker for a removed run. The PDF renderer never uses this — it draws from
 *  segments — but it keeps the text export honest and gives tests a deterministic surface. */
function marker(mode: ExportMode, type: string, length: number): string {
  return mode === 'anonymize' ? `[${type}]` : '█'.repeat(length);
}

/**
 * exportBuilder — produce the genuinely-processed output AND the data the export gate needs
 * (CLAUDE.md §3 output integrity, D8). This is the ONE code path: the preview renders `segments`
 * and `summary`; the real export renders the very same `segments`. So what Sam previews is provably
 * what ships — the preview just doesn't write the file.
 *
 * Integrity guarantee (D9): a redacted span's bytes are NEVER emitted — not into `text`, not into a
 * segment — so raw PII for any redacted span cannot survive, even when spans overlap. Overlaps
 * collapse into a single marker/box, never visual garbage.
 *
 * Pure + I/O-free.
 */
export function buildExport(
  sourceText: string,
  spans: Span[],
  mode: ExportMode = 'redact',
): ExportResult {
  const n = sourceText.length;

  // Mask every redacted source position; remember the type that opens each redacted run.
  const redacted = new Uint8Array(n);
  const typeByStart = new Map<number, string>();
  const redactedSpans = spans.filter((s) => isRedacted(s.status));
  for (const s of [...redactedSpans].sort((a, b) => a.start - b.start)) {
    if (!typeByStart.has(s.start)) typeByStart.set(s.start, s.type);
    for (let i = Math.max(0, s.start); i < Math.min(n, s.end); i++) redacted[i] = 1;
  }

  // Walk the source once: emit one marker per redacted run, copy everything else, build the segment
  // list, and record where each surviving source character lands in the output (so we can locate
  // what remains visible).
  let out = '';
  const srcToOut = new Int32Array(n).fill(-1);
  const segments: DocSegment[] = [];
  let kept = '';
  const flushKept = () => {
    if (kept.length > 0) segments.push({ kind: 'kept', text: kept });
    kept = '';
  };

  let pos = 0;
  while (pos < n) {
    if (redacted[pos]) {
      const type = typeByStart.get(pos) ?? 'PII'; // a run always opens on a span start
      let length = 0;
      while (pos < n && redacted[pos]) {
        pos++;
        length++;
      }
      flushKept();
      segments.push({ kind: 'redacted', type, length });
      out += marker(mode, type, length);
    } else {
      srcToOut[pos] = out.length;
      out += sourceText[pos];
      kept += sourceText[pos];
      pos++;
    }
  }
  flushKept();

  // Locate each still-legible PII span in the output and label why it remains.
  const remaining: RemainingSpan[] = [];
  for (const s of spans) {
    if (isRedacted(s.status)) continue;

    let first = s.start;
    while (first < s.end && (first >= n || srcToOut[first] === -1)) first++;
    let last = Math.min(s.end, n) - 1;
    while (last >= s.start && (last >= n || srcToOut[last] === -1)) last--;
    if (first > last) continue; // fully covered by a redaction (degenerate overlap) → not legible

    const { category, reason } = categorize(s);
    remaining.push({
      type: s.type,
      text: sourceText.slice(s.start, s.end),
      start: srcToOut[first]!,
      end: srcToOut[last]! + 1,
      category,
      reason,
    });
  }
  remaining.sort((a, b) => a.start - b.start);

  return {
    mode,
    text: out,
    segments,
    redactedCount: redactedSpans.length,
    visibleCount: remaining.length,
    remaining,
    summary: summarizeRemaining(remaining),
  };
}

function categorize(span: Span): { category: RemainingCategory; reason: string } {
  if (span.routedTo === 'review' && span.status === 'kept_visible')
    return { category: 'kept', reason: 'you kept this visible' };
  if (span.routedTo === 'review' && span.status === 'suggested')
    return { category: 'undecided', reason: 'not yet reviewed' };
  if (span.routedTo === 'auto' && span.status === 'kept_visible')
    return { category: 'reversed_auto', reason: 'an auto-redaction you reversed' };
  if (span.routedTo === 'visible') return { category: 'left_visible', reason: 'nothing flagged it' };
  return { category: 'left_visible', reason: 'left visible' };
}

/**
 * Turn the still-legible spans into the single calm sentence the export gate shows above the
 * preview. The number is deliberate (D8): a count creates the felt accountability a passive preview
 * doesn't. Phrasing is grouped by WHY each item is still visible, so an overtrusting reader sees not
 * just "3 left" but which ones they chose and which ones nothing ever flagged.
 *
 * Examples:
 *   []                          → "Nothing will remain visible — every detected item is redacted…"
 *   [kept NAME]                 → "1 item will remain visible: a name you kept."
 *   [kept NAME, vis ×2]         → "3 items will remain visible: a name you kept, and 2 things nothing flagged."
 *
 * Pure. Exported so the gate's headline is asserted by tests, never hand-written in the UI.
 */
export function summarizeRemaining(remaining: RemainingSpan[]): string {
  if (remaining.length === 0)
    return 'Nothing will remain visible — every detected item is redacted in the export.';

  // Riskiest-first: things the human never looked at, then their explicit choices, then the calm
  // residue nothing flagged. Empty buckets are skipped.
  const order: RemainingCategory[] = ['undecided', 'reversed_auto', 'kept', 'left_visible'];
  const clauses = order
    .map((category) => clauseFor(category, remaining.filter((r) => r.category === category)))
    .filter((c): c is string => c !== null);

  const joined =
    clauses.length <= 1
      ? clauses.join('')
      : `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`;

  const n = remaining.length;
  return `${n} item${n === 1 ? '' : 's'} will remain visible: ${joined}.`;
}

const CATEGORY_VERB: Record<RemainingCategory, string> = {
  undecided: "you haven't reviewed yet",
  reversed_auto: 'you reversed',
  kept: 'you kept',
  left_visible: 'nothing flagged',
};

/** One clause for a category bucket, or null if it's empty. "a name you kept" / "2 things …". */
function clauseFor(category: RemainingCategory, members: RemainingSpan[]): string | null {
  if (members.length === 0) return null;
  const verb = CATEGORY_VERB[category];
  if (members.length === 1) return `${withArticle(friendlyNoun(members[0]!.type))} ${verb}`;
  return `${members.length} things ${verb}`;
}

const NICE_NOUN: Record<string, string> = {
  PHONE: 'phone number',
  SSN: 'SSN',
  EMAIL: 'email',
  NAME: 'name',
  ADDRESS: 'address',
  ORG: 'organization',
  DATE: 'date',
  CREDIT_CARD: 'card number',
  IP: 'IP address',
};
const friendlyNoun = (type: string): string => NICE_NOUN[type] ?? type.toLowerCase();
const withArticle = (noun: string): string => (/^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`);
