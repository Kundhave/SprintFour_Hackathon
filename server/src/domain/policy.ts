import type { SpanType } from './types';

/**
 * Routing policy constants (CLAUDE.md §3, §4, §7). Kept in one place so the router and reconciler
 * agree on what "structured", "contextual", and "severe" mean, and so tests reference named values
 * instead of magic literals.
 */

/** Structured PII a deterministic rule owns with near-certainty (CLAUDE.md §6, Layer 1). */
export const STRUCTURED_TYPES = new Set<string>(['PHONE', 'EMAIL', 'SSN', 'CREDIT_CARD', 'IP']);

/** Context-dependent PII a rule can't safely judge — ALWAYS goes to a human (CLAUDE.md §4, §7). */
export const CONTEXTUAL_TYPES = new Set<string>(['NAME', 'ADDRESS', 'ORG', 'DATE']);

export const isStructured = (type: SpanType): boolean => STRUCTURED_TYPES.has(type);
export const isContextual = (type: SpanType): boolean => CONTEXTUAL_TYPES.has(type);

/** Tie-breaker for equal-length overlaps: higher severity wins (CLAUDE.md §5). */
const SEVERITY: Record<string, number> = {
  SSN: 6,
  CREDIT_CARD: 6,
  EMAIL: 5,
  PHONE: 5,
  IP: 4,
  ADDRESS: 4,
  NAME: 3,
  ORG: 2,
  DATE: 1,
};
export const severityOf = (type: SpanType): number => SEVERITY[type] ?? 0;

/** Confidence bands for the router (CLAUDE.md §7, rules 4 & 5). */
export const HIGH_CONFIDENCE = 0.85;
export const LOW_CONFIDENCE = 0.35; // strictly below this = "very low / agreed harmless"

/**
 * Reason the reconciler stamps on a span when the two detectors overlap but conflict on type.
 * The router reads this to fire rule 2 ("detectors disagree → human review"). It is also the
 * human-readable reason shown for that decision, matching the example in CLAUDE.md §8.
 */
export const REASON = {
  disagree: 'detectors disagree',
} as const;
