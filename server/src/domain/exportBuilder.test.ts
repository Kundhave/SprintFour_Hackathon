import { describe, it, expect } from 'vitest';
import { buildExport } from './exportBuilder';
import { route } from './router';
import { findStructuredPii } from '../detection/deterministic';
import { makeSpan } from './testSpan';
import { sampleDocument } from '../../../fixtures/sample-document';

describe('exportBuilder — genuine removal (CLAUDE.md §3 output integrity)', () => {
  it('replaces an auto_redacted span with a typed marker, removing the raw bytes', () => {
    const text = 'Call 415-555-7731 today.';
    const span = makeSpan({
      start: 5,
      end: 17,
      text: '415-555-7731',
      type: 'PHONE',
      source: 'deterministic',
      status: 'auto_redacted',
    });

    const result = buildExport(text, [span]);

    expect(result.text).toBe('Call [REDACTED:PHONE] today.');
    expect(result.text).not.toContain('415-555-7731'); // raw PII is gone, not covered
    expect(result.redactedCount).toBe(1);
  });

  it('leaves a non-redacted (review/visible) span intact in the output', () => {
    const text = 'Hello Maria.';
    const span = makeSpan({
      start: 6,
      end: 11,
      text: 'Maria',
      type: 'NAME',
      source: 'semantic',
      status: 'suggested',
      routedTo: 'review',
    });

    const result = buildExport(text, [span]);

    expect(result.text).toBe('Hello Maria.');
    expect(result.redactedCount).toBe(0);
    expect(result.visibleCount).toBe(1);
  });

  it('redacts user-hidden spans too and counts redacted vs. visible correctly', () => {
    const text = 'A 111-11-1111 B Carol C';
    const ssn = makeSpan({ start: 2, end: 13, text: '111-11-1111', type: 'SSN', status: 'hidden_by_user' });
    const name = makeSpan({
      start: 16,
      end: 21,
      text: 'Carol',
      type: 'NAME',
      source: 'semantic',
      status: 'suggested',
      routedTo: 'review',
    });

    const result = buildExport(text, [ssn, name]);

    expect(result.text).toBe('A [REDACTED:SSN] B Carol C');
    expect(result.redactedCount).toBe(1);
    expect(result.visibleCount).toBe(1);
  });

  it('end-to-end slice: every structured PII in the fixture is removed from the export', () => {
    const spans = route(findStructuredPii(sampleDocument));
    const result = buildExport(sampleDocument, spans);

    for (const raw of [
      '(415) 555-0192',
      '415-555-7731',
      '412-55-9087',
      'maria.gonzalez@example.com',
      'sam.carter@northbridge-legal.com',
    ]) {
      expect(result.text).not.toContain(raw);
    }
    expect(result.text).toContain('[REDACTED:PHONE]');
    expect(result.text).toContain('[REDACTED:SSN]');
    expect(result.text).toContain('[REDACTED:EMAIL]');
    expect(result.redactedCount).toBe(5);
  });
});
