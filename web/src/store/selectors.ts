import type { Span, ReviewGroup, AutoGroup, ReviewDecision } from './types';

/**
 * Pure view-derivations (CLAUDE.md §5: views derive from the one store; components hold no logic).
 * Everything here is a deterministic function of the span array + source text.
 */

/** The review lane: only the human-review bucket, grouped by exact string. */
export function selectReviewGroups(spans: Span[], text: string): ReviewGroup[] {
  return bucket(spans.filter((s) => s.routedTo === 'review')).map((members) => {
    const first = members[0]!; // bucket() orders members by position
    return {
      groupKey: first.groupKey,
      type: first.type,
      reason: first.reason,
      count: members.length,
      decision: reviewDecision(members),
      context: sentenceContext(text, first.start, first.end),
    };
  });
}

/** The auto-handled tray: only the auto bucket, grouped by exact string. */
export function selectAutoGroups(spans: Span[]): AutoGroup[] {
  return bucket(spans.filter((s) => s.routedTo === 'auto')).map((members) => {
    const first = members[0]!;
    return {
      groupKey: first.groupKey,
      type: first.type,
      reason: first.reason,
      count: members.length,
      reversed: members.every((s) => s.status === 'kept_visible'),
    };
  });
}

/** Total auto-handled occurrences — the N in "Auto-handled (N)". */
export const selectAutoCount = (spans: Span[]): number =>
  spans.filter((s) => s.routedTo === 'auto').length;

/** Group spans by exact groupKey, preserving first-occurrence order. */
function bucket(spans: Span[]): Span[][] {
  const groups = new Map<string, Span[]>();
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const members = groups.get(span.groupKey) ?? [];
    members.push(span);
    groups.set(span.groupKey, members);
  }
  return [...groups.values()];
}

function reviewDecision(members: Span[]): ReviewDecision {
  if (members.every((s) => s.status === 'hidden_by_user')) return 'hidden';
  if (members.every((s) => s.status === 'kept_visible')) return 'kept';
  return 'undecided';
}

/** The sentence around a span, split so the match can be highlighted. Boundaries are . ! ? newline. */
function sentenceContext(
  text: string,
  start: number,
  end: number,
): { before: string; match: string; after: string } {
  const isBoundary = (ch: string) => ch === '.' || ch === '!' || ch === '?' || ch === '\n';

  let from = start;
  while (from > 0 && !isBoundary(text[from - 1]!)) from--;

  let to = end;
  while (to < text.length && !isBoundary(text[to]!)) to++;

  return {
    before: text.slice(from, start).replace(/^\s+/, ''),
    match: text.slice(start, end),
    after: text.slice(end, to),
  };
}
