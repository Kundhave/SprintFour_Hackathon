import type { Span, SpanType } from './types';

/**
 * A semantic finding as returned by the LLM: a verbatim string + type + confidence, NEVER offsets
 * (CLAUDE.md §9). The model miscounts positions, so we never trust offsets from it.
 */
export type SemanticFinding = {
  text: string;
  type: SpanType;
  confidence: number;
};

/**
 * locateSpans — turn LLM findings into located Spans by finding every exact occurrence of each
 * string in the source OURSELVES (CLAUDE.md §8: start/end "located deterministically in our code,
 * never trusted from the LLM").
 *
 * - Every non-overlapping occurrence of a finding's text becomes its own Span (so repeated PII is
 *   fully covered; the grouper later links identical strings).
 * - A finding whose text does NOT appear verbatim in the source is dropped — we never redact text
 *   we cannot point to (a hallucinated string is not in the document anyway).
 *
 * Pure + I/O-free, so it is unit-tested directly and deterministically.
 */
export function locateSpans(sourceText: string, findings: SemanticFinding[]): Span[] {
  const spans: Span[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const needle = finding.text;
    if (needle.length === 0) continue;

    let idx = sourceText.indexOf(needle);
    while (idx !== -1) {
      const start = idx;
      const end = idx + needle.length;
      const id = `semantic:${finding.type}:${start}-${end}`;
      if (!seen.has(id)) {
        seen.add(id);
        spans.push({
          id,
          start,
          end,
          text: needle,
          type: finding.type,
          source: 'semantic',
          confidence: clamp01(finding.confidence),
          status: 'suggested',
          routedTo: 'review', // placeholder; the router assigns the real route
          reason: '',
          groupKey: needle, // exact-match key; the grouper may refine this later
        });
      }
      idx = sourceText.indexOf(needle, end); // next non-overlapping occurrence
    }
  }

  return spans.sort((a, b) => a.start - b.start || a.end - b.end);
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
