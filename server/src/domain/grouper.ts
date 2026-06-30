import type { Span } from './types';

/**
 * grouper — EXACT-MATCH string grouping only. NO entity resolution (CLAUDE.md §5, §12).
 *
 * Contract (to implement):
 *   - Identical strings get the same `groupKey` so they become a single decision for the human.
 *   - "J. Smith" and "John Smith" are NOT linked — that's coreference, deliberately out of scope.
 *
 * Pure + I/O-free.
 *
 * NOTE: structure only — no logic implemented yet.
 */
export function group(spans: Span[]): Span[] {
  // TODO: assign groupKey by exact string match (e.g. normalized `text`).
  return spans;
}
