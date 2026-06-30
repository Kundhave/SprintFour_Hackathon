/**
 * Domain model — defined ONCE here, imported everywhere (CLAUDE.md §8).
 * Do not redeclare `Span` in the frontend or detectors; import this type.
 */

/** Structured types are deterministically detectable; contextual types must go to a human. */
export type SpanType =
  | 'PHONE'
  | 'EMAIL'
  | 'SSN'
  | 'NAME'
  | 'ADDRESS'
  | 'ORG'
  | 'DATE'
  | (string & {});

export type SpanSource = 'deterministic' | 'semantic' | 'user';

export type SpanStatus =
  | 'suggested'
  | 'auto_redacted'
  | 'kept_visible'
  | 'hidden_by_user'
  | 'user_added';

export type RoutedTo = 'auto' | 'review' | 'visible';

export type Span = {
  id: string;
  start: number; // located deterministically in our code, never trusted from the LLM
  end: number;
  text: string;
  type: SpanType;
  source: SpanSource;
  confidence: number;
  status: SpanStatus;
  routedTo: RoutedTo;
  reason: string; // human-readable: why it's here ("detectors disagree", "name — contextual")
  groupKey: string; // exact-match string → links identical occurrences
};
