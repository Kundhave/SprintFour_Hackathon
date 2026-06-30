import { describe, it, expect } from 'vitest';
import { locateSpans, type SemanticFinding } from './locate';

describe('locateSpans — we find offsets ourselves (CLAUDE.md §8/§9)', () => {
  it('locates every exact occurrence of a finding and sets correct offsets', () => {
    const text = 'John met John at the office.';
    const findings: SemanticFinding[] = [{ text: 'John', type: 'NAME', confidence: 0.9 }];

    const spans = locateSpans(text, findings);

    expect(spans).toHaveLength(2);
    expect(spans.map((s) => [s.start, s.end])).toEqual([
      [0, 4],
      [9, 13],
    ]);
    for (const s of spans) {
      expect(text.slice(s.start, s.end)).toBe('John');
      expect(s.source).toBe('semantic');
      expect(s.status).toBe('suggested');
    }
  });

  it('drops a finding whose text does not appear verbatim in the source', () => {
    const spans = locateSpans('Hello world', [{ text: 'Zoe', type: 'NAME', confidence: 0.9 }]);
    expect(spans).toEqual([]);
  });

  it('clamps confidence into [0, 1]', () => {
    const spans = locateSpans('ACME', [{ text: 'ACME', type: 'ORG', confidence: 5 }]);
    expect(spans[0]!.confidence).toBe(1);
  });

  it('returns spans sorted by position', () => {
    const text = 'ACME hired Dana.';
    const findings: SemanticFinding[] = [
      { text: 'Dana', type: 'NAME', confidence: 0.9 },
      { text: 'ACME', type: 'ORG', confidence: 0.9 },
    ];
    const spans = locateSpans(text, findings);
    expect(spans.map((s) => s.start)).toEqual([0, 11]);
  });
});
