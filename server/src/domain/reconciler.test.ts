import { describe, it, expect } from 'vitest';
import { reconcile } from './reconciler';
import { REASON } from './policy';
import { makeSpan } from './testSpan';
import { mockDetector } from '../detection/mock';
import type { Span } from './types';

/** Source spans through the mock detector so the tests are deterministic (CLAUDE.md §10). */
async function detect(det: Span[], sem: Span[]): Promise<Span[]> {
  const deterministic = await mockDetector(det).detect('');
  const semantic = await mockDetector(sem).detect('');
  return reconcile(deterministic, semantic);
}

describe('reconciler — merge', () => {
  it('keeps non-overlapping spans from both detectors, sorted by position', async () => {
    const det = [makeSpan({ start: 10, end: 15, type: 'PHONE', source: 'deterministic' })];
    const sem = [makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic' })];

    const merged = await detect(det, sem);

    expect(merged.map((s) => s.type)).toEqual(['NAME', 'PHONE']);
    expect(merged).toHaveLength(2);
  });

  it('deduplicates identical spans from the same detector', async () => {
    const a = makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic' });
    const b = makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic' });

    const merged = await detect([], [a, b]);

    expect(merged).toHaveLength(1);
  });

  it('does not mutate the input spans', async () => {
    const sem = makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic', confidence: 0.5 });
    const det = makeSpan({ start: 0, end: 4, type: 'NAME', source: 'deterministic', confidence: 0.9 });

    await detect([det], [sem]);

    expect(sem.confidence).toBe(0.5); // untouched
    expect(det.confidence).toBe(0.9);
  });
});

describe('reconciler — overlap resolution', () => {
  it('keeps the LONGER span when two overlap', async () => {
    const short = makeSpan({ start: 0, end: 3, type: 'NAME', source: 'semantic' });
    const long = makeSpan({ start: 0, end: 8, type: 'ADDRESS', source: 'semantic' });

    const merged = await detect([], [short, long]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.end).toBe(8);
    expect(merged[0]!.type).toBe('ADDRESS');
  });

  it('breaks an equal-length tie by HIGHER severity', async () => {
    const ssn = makeSpan({ start: 0, end: 5, type: 'SSN', source: 'semantic' });
    const date = makeSpan({ start: 0, end: 5, type: 'DATE', source: 'semantic' });

    const merged = await detect([], [date, ssn]); // order should not matter

    expect(merged).toHaveLength(1);
    expect(merged[0]!.type).toBe('SSN');
  });

  it('marks AGREEMENT (same type, both detectors) by strengthening confidence, no disagree flag', async () => {
    const det = makeSpan({ start: 0, end: 4, type: 'NAME', source: 'deterministic', confidence: 0.6 });
    const sem = makeSpan({ start: 0, end: 4, type: 'NAME', source: 'semantic', confidence: 0.95 });

    const merged = await detect([det], [sem]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.confidence).toBe(0.95);
    expect(merged[0]!.reason).not.toBe(REASON.disagree);
  });

  it('marks DISAGREEMENT (overlap, different type, different detectors) on the winning span', async () => {
    const det = makeSpan({ start: 0, end: 3, type: 'PHONE', source: 'deterministic' });
    const sem = makeSpan({ start: 0, end: 8, type: 'ADDRESS', source: 'semantic' });

    const merged = await detect([det], [sem]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.type).toBe('ADDRESS'); // longer span wins
    expect(merged[0]!.reason).toBe(REASON.disagree);
  });
});
