import type { Span } from './types';

/**
 * Test-only Span factory. Fills sensible defaults so each test states ONLY the fields it cares
 * about (start/end, type, source, confidence, reason). Not exported from the domain barrel.
 */
export function makeSpan(partial: Partial<Span> & { start: number; end: number }): Span {
  const type = partial.type ?? 'NAME';
  const source = partial.source ?? 'deterministic';
  const text = partial.text ?? 'x';
  return {
    id: partial.id ?? `${source}:${type}:${partial.start}-${partial.end}`,
    start: partial.start,
    end: partial.end,
    text,
    type,
    source,
    confidence: partial.confidence ?? 0.9,
    status: partial.status ?? 'suggested',
    routedTo: partial.routedTo ?? 'review',
    reason: partial.reason ?? '',
    groupKey: partial.groupKey ?? text,
  };
}
