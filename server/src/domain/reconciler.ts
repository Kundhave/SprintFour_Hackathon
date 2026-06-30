import type { Span } from './types';
import { severityOf, REASON } from './policy';

/**
 * reconciler — merge the two detectors' spans and resolve overlaps (CLAUDE.md §5).
 *
 * Overlap rule: the LONGER span wins; ties break by HIGHER SEVERITY, then by deterministic source
 * (structured certainty) over semantic. We process candidates strongest-first and keep a span only
 * if it does not overlap an already-kept (stronger) span — so the kept set is always the set of
 * winners, and any overlap handles multi-span pile-ups correctly.
 *
 * Cross-detector signal (CLAUDE.md §6, §13): when a dropped span overlaps a kept span from the
 * OTHER detector,
 *   - same type  → AGREEMENT  → strengthen the winner's confidence (both detectors saw it);
 *   - diff type  → DISAGREEMENT → stamp the winner with REASON.disagree so the router sends it to
 *                                 a human (disagreement is a route-to-human signal).
 *
 * Pure + I/O-free. Inputs are never mutated.
 */
export function reconcile(deterministic: Span[], semantic: Span[]): Span[] {
  const candidates = [...deterministic, ...semantic].sort(byDominance);
  const kept: Span[] = [];

  for (const candidate of candidates) {
    const winners = kept.filter((k) => overlaps(k, candidate));

    if (winners.length === 0) {
      kept.push({ ...candidate }); // copy so we never mutate the detectors' inputs
      continue;
    }

    // `candidate` is dominated by one or more already-kept spans → drop it, but record the
    // cross-detector relationship onto each winner it overlaps.
    for (const winner of winners) {
      if (winner.source === candidate.source) continue; // same detector → just a duplicate/overlap
      if (winner.type === candidate.type) {
        winner.confidence = Math.max(winner.confidence, candidate.confidence); // agreement
      } else {
        winner.reason = REASON.disagree; // disagreement → human
      }
    }
  }

  return kept.sort((a, b) => a.start - b.start || a.end - b.end);
}

const lengthOf = (s: Span): number => s.end - s.start;
const overlaps = (a: Span, b: Span): boolean => a.start < b.end && b.start < a.end;

/** Strongest-first ordering: longer, then higher severity, then deterministic, then earlier. */
function byDominance(a: Span, b: Span): number {
  const byLength = lengthOf(b) - lengthOf(a);
  if (byLength !== 0) return byLength;
  const bySeverity = severityOf(b.type) - severityOf(a.type);
  if (bySeverity !== 0) return bySeverity;
  if (a.source !== b.source) return a.source === 'deterministic' ? -1 : 1;
  return a.start - b.start;
}
