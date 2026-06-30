import { describe, it, expect } from 'vitest';
import { route } from './router';
import { REASON } from './policy';
import { makeSpan } from './testSpan';
import { mockDetector } from '../detection/mock';
import type { Span } from './types';

/** Route a single span sourced through the mock detector (CLAUDE.md §10). */
async function routeOne(span: Span): Promise<Span> {
  const spans = await mockDetector([span]).detect('');
  return route(spans)[0]!;
}

describe('router — the five rules (priority order, CLAUDE.md §7)', () => {
  it('rule 1: deterministic + structured → AUTO-REDACT', async () => {
    const out = await routeOne(makeSpan({ start: 0, end: 5, type: 'SSN', source: 'deterministic' }));
    expect(out.routedTo).toBe('auto');
    expect(out.status).toBe('auto_redacted');
  });

  it('rule 1 ignores confidence: a low-confidence deterministic structured match still auto-redacts', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 5, type: 'PHONE', source: 'deterministic', confidence: 0.1 }),
    );
    expect(out.routedTo).toBe('auto');
  });

  it('rule 2: detectors disagree → HUMAN REVIEW (and beats the contextual rule)', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic', reason: REASON.disagree }),
    );
    expect(out.routedTo).toBe('review');
    expect(out.reason).toBe(REASON.disagree);
  });

  it('rule 3: context-dependent type → HUMAN REVIEW regardless of confidence', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic', confidence: 0.99 }),
    );
    expect(out.routedTo).toBe('review');
    expect(out.reason).toContain('contextual');
  });

  it('rule 4: mid-confidence non-structural → HUMAN REVIEW', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 4, type: 'MISC', source: 'semantic', confidence: 0.6 }),
    );
    expect(out.routedTo).toBe('review');
    expect(out.reason).toContain('mid-confidence');
  });

  it('rule 4: high-confidence but non-structural type still routes to a human (borderline bias)', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 4, type: 'MISC', source: 'semantic', confidence: 0.95 }),
    );
    expect(out.routedTo).toBe('review');
  });

  it('rule 5: very low confidence / agreed harmless → LEAVE VISIBLE', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 4, type: 'MISC', source: 'semantic', confidence: 0.2 }),
    );
    expect(out.routedTo).toBe('visible');
    expect(out.status).toBe('kept_visible');
  });
});

describe('router — the invariant (CLAUDE.md §4)', () => {
  it('NEVER auto-redacts a context-dependent type, even a deterministic high-confidence one', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 4, type: 'NAME', source: 'deterministic', confidence: 1 }),
    );
    expect(out.routedTo).not.toBe('auto');
    expect(out.routedTo).toBe('review');
  });

  it('NEVER auto-redacts a structured type detected only by the semantic detector', async () => {
    const out = await routeOne(
      makeSpan({ start: 0, end: 5, type: 'PHONE', source: 'semantic', confidence: 0.95 }),
    );
    expect(out.routedTo).not.toBe('auto');
  });

  it('no span is ever routed to expose: the router only produces auto / review / visible', async () => {
    const inputs = await mockDetector([
      makeSpan({ start: 0, end: 5, type: 'SSN', source: 'deterministic' }),
      makeSpan({ start: 6, end: 10, type: 'NAME', source: 'semantic' }),
      makeSpan({ start: 11, end: 14, type: 'MISC', source: 'semantic', confidence: 0.1 }),
    ]).detect('');

    for (const span of route(inputs)) {
      expect(['auto', 'review', 'visible']).toContain(span.routedTo);
      expect(span.status).not.toBe('hidden_by_user'); // routing never silently un-hides/exposes
    }
  });
});
