import type { Span } from './types';

/**
 * grouper — EXACT-MATCH string grouping only (CLAUDE.md §5, §6, §12). NO entity resolution.
 *
 * Identical strings get the same `groupKey`, so the UI can resolve them into a single decision
 * applied to every occurrence ("appears 9×"). "J. Smith" and "John Smith" are deliberately NOT
 * linked — that's coreference, and it carries its own review burden we chose not to take on.
 *
 * Pure + I/O-free. The groupKey is the exact matched string; nothing is normalized away.
 */
export function group(spans: Span[]): Span[] {
  return spans.map((span) => ({ ...span, groupKey: span.text }));
}
