import type { Detector } from './detector';
import type { Span } from '../domain/types';

/**
 * Mock detector — same interface as the real ones (CLAUDE.md §5).
 *
 * Two jobs:
 *   1. Deterministic test double for the domain layer (domain is tested via the Mock, never the
 *      live LLM, which is nondeterministic — CLAUDE.md §10).
 *   2. Demo-day fallback: if the local model is unavailable, the app still runs end to end.
 *
 * NOTE: structure only — returns no spans yet. Tests can inject fixed spans via `mockDetector(spans)`.
 */
export function mockDetector(spans: Span[] = []): Detector {
  return {
    name: 'mock',
    async detect(_text: string): Promise<Span[]> {
      return spans;
    },
  };
}
