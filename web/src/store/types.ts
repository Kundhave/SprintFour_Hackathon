// Single Span definition (CLAUDE.md §8/§10): import the domain type, never redeclare it.
// Type-only import — erased at build time, so no server runtime is pulled into the bundle.
import type { Span } from '../../../server/src/domain/types';
import type {
  ExportResult,
  ExportMode,
  DocSegment,
  RemainingSpan,
  RemainingCategory,
} from '../../../server/src/domain/exportBuilder';

export type { Span, ExportResult, ExportMode, DocSegment, RemainingSpan, RemainingCategory };

/** Where a review group currently stands, derived from its spans' statuses. */
export type ReviewDecision = 'hidden' | 'kept' | 'undecided';

/** One human-review decision, covering every identical occurrence (exact-match grouping). */
export type ReviewGroup = {
  groupKey: string;
  type: string;
  reason: string;
  count: number;
  decision: ReviewDecision;
  context: { before: string; match: string; after: string };
};

/** One auto-handled item in the collapsed tray. */
export type AutoGroup = {
  groupKey: string;
  type: string;
  reason: string;
  count: number;
  reversed: boolean;
};
