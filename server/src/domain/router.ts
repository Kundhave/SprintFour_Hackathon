import type { Span, RoutedTo, SpanStatus } from './types';
import {
  isStructured,
  isContextual,
  HIGH_CONFIDENCE,
  LOW_CONFIDENCE,
  REASON,
} from './policy';

/**
 * router — classify each span into auto / review / visible by the five rules in priority order
 * (CLAUDE.md §7). First matching rule wins.
 *
 *   1. Deterministic match on a structured type        → AUTO-REDACT (safe direction; disclose in tray)
 *   2. Detectors disagree                              → HUMAN REVIEW
 *   3. Context-dependent type (NAME/ADDRESS/ORG/DATE)  → HUMAN REVIEW, regardless of confidence
 *   4. Mid (and high non-structural) confidence        → HUMAN REVIEW   (bias borderline → human)
 *   5. Very low confidence / agreed harmless           → LEAVE VISIBLE, don't surface
 *
 * THE INVARIANT (CLAUDE.md §4): only rule 1 auto-acts, and it only HIDES — we never auto-EXPOSE,
 * and a context-dependent span is never auto-redacted (rule 1 requires a structured type; contextual
 * types fall to rule 3). Borderline cases route toward the human on purpose.
 *
 * Pure + I/O-free. Must run last.
 */
export function route(spans: Span[]): Span[] {
  return spans.map(routeOne);
}

function routeOne(span: Span): Span {
  // Rule 1 — deterministic, structured → auto-redact. Confidence is irrelevant (a regex hit is
  // certain), and redaction is always the safe direction.
  if (span.source === 'deterministic' && isStructured(span.type)) {
    return decide(span, 'auto', 'auto_redacted', `${span.type} — deterministic match, auto-redacted`);
  }

  // Rule 2 — the two detectors disagreed on this region (stamped by the reconciler).
  if (span.reason === REASON.disagree) {
    return decide(span, 'review', 'suggested', REASON.disagree);
  }

  // Rule 3 — context-dependent type. Never auto-redacted, regardless of confidence.
  if (isContextual(span.type)) {
    return decide(span, 'review', 'suggested', `${span.type} — contextual, needs a human`);
  }

  // Rule 5 — agreed harmless / very low confidence → leave visible, do not surface.
  if (span.confidence < LOW_CONFIDENCE) {
    return decide(span, 'visible', 'kept_visible', 'low signal — left visible');
  }

  // Rule 4 — everything else borderline (mid confidence, or high-confidence non-structural) routes
  // to the human, because over-asking costs seconds and under-asking risks the catastrophic miss.
  const band = span.confidence < HIGH_CONFIDENCE ? 'mid-confidence' : 'uncertain type';
  return decide(span, 'review', 'suggested', `${band} — needs a human`);
}

function decide(span: Span, routedTo: RoutedTo, status: SpanStatus, reason: string): Span {
  return { ...span, routedTo, status, reason };
}
