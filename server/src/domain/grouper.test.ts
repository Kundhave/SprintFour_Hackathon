import { describe, it, expect } from 'vitest';
import { group } from './grouper';
import { makeSpan } from './testSpan';

describe('grouper — exact-match string grouping (CLAUDE.md §6)', () => {
  it('gives identical strings the same groupKey so they become one decision', () => {
    const a = makeSpan({ start: 0, end: 5, text: 'Sam', type: 'NAME', source: 'semantic' });
    const b = makeSpan({ start: 40, end: 43, text: 'Sam', type: 'NAME', source: 'semantic' });

    const [ga, gb] = group([a, b]);

    expect(ga!.groupKey).toBe('Sam');
    expect(gb!.groupKey).toBe('Sam');
    expect(ga!.groupKey).toBe(gb!.groupKey);
  });

  it('gives different strings different groupKeys', () => {
    const a = makeSpan({ start: 0, end: 14, text: 'Maria Gonzalez', type: 'NAME', source: 'semantic' });
    const b = makeSpan({ start: 20, end: 32, text: 'David Okafor', type: 'NAME', source: 'semantic' });

    const [ga, gb] = group([a, b]);
    expect(ga!.groupKey).not.toBe(gb!.groupKey);
  });

  it('does NOT link coreferent variants (no entity resolution)', () => {
    const a = makeSpan({ start: 0, end: 10, text: 'John Smith', type: 'NAME', source: 'semantic' });
    const b = makeSpan({ start: 20, end: 28, text: 'J. Smith', type: 'NAME', source: 'semantic' });

    const [ga, gb] = group([a, b]);
    expect(ga!.groupKey).not.toBe(gb!.groupKey);
  });
});
