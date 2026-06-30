import { describe, it, expect } from 'vitest';
import { deterministicDetector, findStructuredPii } from './deterministic';

describe('deterministic detector — certainty on structured PII (CLAUDE.md §6 Layer 1)', () => {
  it('detects phone, email, and SSN with source=deterministic and correct offsets', async () => {
    const text = 'Reach me at jane.doe@acme.io or (212) 555-0143. SSN 078-05-1120.';

    const spans = await deterministicDetector.detect(text);
    const byType = Object.fromEntries(spans.map((s) => [s.type, s]));

    expect(new Set(spans.map((s) => s.type))).toEqual(new Set(['EMAIL', 'PHONE', 'SSN']));
    for (const s of spans) {
      expect(s.source).toBe('deterministic');
      expect(s.confidence).toBe(1);
      expect(text.slice(s.start, s.end)).toBe(s.text); // offsets are located, not guessed
    }
    expect(byType.EMAIL!.text).toBe('jane.doe@acme.io');
    expect(byType.PHONE!.text).toBe('(212) 555-0143');
    expect(byType.SSN!.text).toBe('078-05-1120');
  });

  it('does not misread a 3-2-4 SSN as a phone number', () => {
    const spans = findStructuredPii('SSN 412-55-9087 only.');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.type).toBe('SSN');
  });

  it('returns nothing for text with no structured PII', async () => {
    expect(await deterministicDetector.detect('Just a friendly note, nothing sensitive.')).toEqual([]);
  });
});
