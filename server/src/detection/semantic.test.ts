import { describe, it, expect } from 'vitest';
import { parseFindings } from './semantic';

/**
 * parseFindings is pure (no model call), so we test the validation/normalization contract here
 * deterministically. The live Ollama call is never unit-tested (nondeterministic — CLAUDE.md §10).
 */
describe('parseFindings — narrow contract + robustness (CLAUDE.md §9)', () => {
  it('parses the expected {items:[...]} shape', () => {
    const raw = JSON.stringify({
      items: [{ text: 'Maria Gonzalez', type: 'NAME', confidence: 0.9 }],
    });
    expect(parseFindings(raw)).toEqual([{ text: 'Maria Gonzalez', type: 'NAME', confidence: 0.9 }]);
  });

  it('accepts a bare top-level array', () => {
    const raw = JSON.stringify([{ text: 'ACME', type: 'ORG', confidence: 0.8 }]);
    expect(parseFindings(raw)).toEqual([{ text: 'ACME', type: 'ORG', confidence: 0.8 }]);
  });

  it('normalizes type synonyms (PERSON → NAME, ORGANIZATION → ORG, LOCATION → ADDRESS)', () => {
    const raw = JSON.stringify({
      items: [
        { text: 'Dana', type: 'person', confidence: 0.9 },
        { text: 'Globex', type: 'ORGANIZATION', confidence: 0.7 },
        { text: '1 Main St', type: 'location', confidence: 0.6 },
      ],
    });
    expect(parseFindings(raw)?.map((f) => f.type)).toEqual(['NAME', 'ORG', 'ADDRESS']);
  });

  it('drops items missing text or with an unknown type, keeps the valid ones', () => {
    const raw = JSON.stringify({
      items: [
        { text: '', type: 'NAME', confidence: 0.9 },
        { text: 'Bob', type: 'WIDGET', confidence: 0.9 },
        { text: 'Carol', type: 'NAME', confidence: 0.9 },
      ],
    });
    expect(parseFindings(raw)).toEqual([{ text: 'Carol', type: 'NAME', confidence: 0.9 }]);
  });

  it('coerces a missing confidence to a mid default', () => {
    const raw = JSON.stringify({ items: [{ text: 'Dana', type: 'NAME' }] });
    expect(parseFindings(raw)?.[0]!.confidence).toBe(0.5);
  });

  it('returns null on non-JSON output (caller will retry once, then return empty)', () => {
    expect(parseFindings('not json at all')).toBeNull();
  });

  it('returns null when the JSON is not a list-shaped result', () => {
    expect(parseFindings(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });
});
