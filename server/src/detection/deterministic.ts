import type { Detector } from './detector';
import type { Span } from '../domain/types';

/**
 * Layer 1 — Deterministic detector: regex for structured PII (CLAUDE.md §6).
 *
 * Capability: CERTAINTY on structured PII (PHONE, EMAIL, SSN) where a rule beats a model. Runs
 * first, independent, free. This is what catches the planted phone number with certainty — not a
 * guess. Offsets are located here (in our own code), exactly as the Span contract requires.
 */

type StructuredType = 'PHONE' | 'EMAIL' | 'SSN';

/** One well-named pattern per structured PII kind. Order matters: SSN before PHONE so a
 *  3-2-4 SSN is never mistaken for a 3-3-4 phone number. */
const PATTERNS: ReadonlyArray<{ type: StructuredType; regex: RegExp }> = [
  { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'PHONE', regex: /(?:\(\d{3}\)\s*|\d{3}[-.\s])\d{3}[-.\s]\d{4}/g },
];

export const deterministicDetector: Detector = {
  name: 'deterministic',
  async detect(text: string): Promise<Span[]> {
    return findStructuredPii(text);
  },
};

/**
 * Pure: scan the text with each pattern and return non-overlapping deterministic spans.
 * Exported separately so the detection slice is unit-testable without any I/O.
 */
export function findStructuredPii(text: string): Span[] {
  const found: Span[] = [];

  for (const { type, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      const start = match.index;
      const end = start + value.length;
      found.push({
        id: `deterministic:${type}:${start}-${end}`,
        start,
        end,
        text: value,
        type,
        source: 'deterministic',
        confidence: 1, // a rule hit is certain, not probabilistic
        status: 'suggested',
        routedTo: 'review', // placeholder; the router assigns the real route
        reason: '',
        groupKey: value,
      });
    }
  }

  return dropOverlaps(found);
}

/** Keep non-overlapping matches (longest first), so a value matched by two patterns counts once. */
function dropOverlaps(spans: Span[]): Span[] {
  const lengthOf = (s: Span): number => s.end - s.start;
  const sorted = [...spans].sort((a, b) => a.start - b.start || lengthOf(b) - lengthOf(a));
  const kept: Span[] = [];
  for (const span of sorted) {
    if (kept.some((k) => span.start < k.end && k.start < span.end)) continue;
    kept.push(span);
  }
  return kept.sort((a, b) => a.start - b.start);
}
