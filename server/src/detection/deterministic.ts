import type { Detector } from './detector';
import type { Span } from '../domain/types';

/**
 * Layer 1 — Deterministic detector: regex + a small name list (CLAUDE.md §6).
 *
 * Capability: CERTAINTY on structured PII (PHONE, EMAIL, SSN, …) where a rule beats a model.
 * Runs first, independent, free. This is what catches the planted phone number with certainty.
 *
 * NOTE: structure only — no patterns implemented yet.
 */
export const deterministicDetector: Detector = {
  name: 'deterministic',
  async detect(_text: string): Promise<Span[]> {
    // TODO: regex passes for PHONE/EMAIL/SSN/etc. + small name-list lookup. Locate offsets here.
    return [];
  },
};
