import { describe, it, expect } from 'vitest';
import { buildExport, summarizeRemaining, type RemainingSpan } from './exportBuilder';
import { route } from './router';
import { findStructuredPii } from '../detection/deterministic';
import { makeSpan } from './testSpan';
import { sampleDocument } from '../../../fixtures/sample-document';

describe('exportBuilder — genuine removal in both modes (CLAUDE.md §3 output integrity)', () => {
  const phone = () =>
    makeSpan({ start: 5, end: 17, text: '415-555-7731', type: 'PHONE', status: 'auto_redacted' });

  it('anonymize: replaces a removed span with its semantic label, dropping the raw bytes', () => {
    const result = buildExport('Call 415-555-7731 today.', [phone()], 'anonymize');

    expect(result.mode).toBe('anonymize');
    expect(result.text).toBe('Call [PHONE] today.');
    expect(result.text).not.toContain('415-555-7731');
    expect(result.segments).toEqual([
      { kind: 'kept', text: 'Call ' },
      { kind: 'redacted', type: 'PHONE', length: 12 },
      { kind: 'kept', text: ' today.' },
    ]);
    expect(result.redactedCount).toBe(1);
  });

  it('redact: removes the span entirely (a box is drawn by the renderer), not "[REDACTED]"', () => {
    const result = buildExport('Call 415-555-7731 today.', [phone()], 'redact');

    expect(result.mode).toBe('redact');
    expect(result.text).toBe(`Call ${'█'.repeat(12)} today.`);
    expect(result.text).not.toContain('415-555-7731');
    expect(result.text).not.toContain('[REDACTED]'); // the bytes are gone, not labelled
    expect(result.segments).toContainEqual({ kind: 'redacted', type: 'PHONE', length: 12 });
  });

  it('redacted segments never carry the original bytes (renderer can never leak them)', () => {
    const result = buildExport('Call 415-555-7731 today.', [phone()], 'redact');
    const redactedSeg = result.segments.find((s) => s.kind === 'redacted');
    expect(JSON.stringify(redactedSeg)).not.toContain('415-555-7731');
  });

  it('leaves a non-redacted (review/visible) span intact in the output', () => {
    const span = makeSpan({
      start: 6,
      end: 11,
      text: 'Maria',
      type: 'NAME',
      source: 'semantic',
      status: 'suggested',
      routedTo: 'review',
    });
    const result = buildExport('Hello Maria.', [span], 'anonymize');

    expect(result.text).toBe('Hello Maria.');
    expect(result.redactedCount).toBe(0);
    expect(result.visibleCount).toBe(1);
  });

  it('end-to-end slice: every structured PII in the fixture is removed from the export', () => {
    const spans = route(findStructuredPii(sampleDocument));
    const result = buildExport(sampleDocument, spans, 'anonymize');

    for (const raw of [
      '(415) 555-0192',
      '415-555-7731',
      '412-55-9087',
      'maria.gonzalez@example.com',
      'sam.carter@northbridge-legal.com',
    ]) {
      expect(result.text).not.toContain(raw);
    }
    expect(result.text).toContain('[PHONE]');
    expect(result.text).toContain('[SSN]');
    expect(result.text).toContain('[EMAIL]');
    expect(result.redactedCount).toBe(5);
  });
});

describe('exportBuilder — every state handled calmly (CLAUDE.md §10, §13)', () => {
  it('empty document: clean export, nothing visible, no crash', () => {
    const result = buildExport('', [], 'redact');
    expect(result.text).toBe('');
    expect(result.segments).toEqual([]);
    expect(result.redactedCount).toBe(0);
    expect(result.visibleCount).toBe(0);
    expect(result.summary).toMatch(/^Nothing will remain visible/);
  });

  it('no PII found: routes through the gate with the document intact and a clean count', () => {
    const text = 'The weather is fine and the meeting is at noon.';
    const result = buildExport(text, [], 'anonymize');
    expect(result.text).toBe(text);
    expect(result.segments).toEqual([{ kind: 'kept', text }]);
    expect(result.visibleCount).toBe(0);
    expect(result.summary).toMatch(/^Nothing will remain visible/);
  });

  it('all-PII document: the entire text becomes a single removed run, raw bytes gone', () => {
    const text = '415-555-7731';
    const span = makeSpan({ start: 0, end: 12, text, type: 'PHONE', status: 'auto_redacted' });

    const anon = buildExport(text, [span], 'anonymize');
    expect(anon.text).toBe('[PHONE]');
    expect(anon.segments).toEqual([{ kind: 'redacted', type: 'PHONE', length: 12 }]);

    const red = buildExport(text, [span], 'redact');
    expect(red.text).toBe('█'.repeat(12));
    expect(red.text).not.toContain('415-555-7731');
    expect(red.visibleCount).toBe(0);
  });

  it('overlapping redacted spans collapse into ONE run — never visual garbage', () => {
    const text = 'X 415-555-7731 Y';
    const a = makeSpan({ start: 2, end: 14, text: '415-555-7731', type: 'PHONE', status: 'auto_redacted' });
    const b = makeSpan({ start: 6, end: 14, text: '55-7731', type: 'PHONE', status: 'hidden_by_user' });
    const result = buildExport(text, [a, b], 'anonymize');

    expect(result.text).toBe('X [PHONE] Y');
    expect(result.text).not.toContain('415-555-7731');
    expect(result.segments.filter((s) => s.kind === 'redacted')).toHaveLength(1); // one run, one box
  });

  it('a visible span fully covered by a redaction does not leak and is not counted legible', () => {
    const text = 'SSN 111-11-1111 end';
    const redacted = makeSpan({ start: 4, end: 15, text: '111-11-1111', type: 'SSN', status: 'auto_redacted' });
    const buried = makeSpan({
      start: 8,
      end: 15,
      text: '11-1111',
      type: 'NAME',
      source: 'semantic',
      status: 'suggested',
      routedTo: 'review',
    });
    const result = buildExport(text, [redacted, buried], 'redact');

    expect(result.text).not.toContain('111-11-1111');
    expect(result.text).not.toContain('11-1111');
    expect(result.visibleCount).toBe(0);
  });
});

describe('exportBuilder — integrity invariant across states & modes (CLAUDE.md §3, D9)', () => {
  it('for EVERY redacted span, its raw text is absent from the exported content', () => {
    const text = 'Call 415-555-7731 or email a@b.com; SSN 111-11-1111; keep Alice visible.';
    const spans = [
      makeSpan({ start: 5, end: 17, text: '415-555-7731', type: 'PHONE', status: 'auto_redacted' }),
      makeSpan({ start: 27, end: 34, text: 'a@b.com', type: 'EMAIL', status: 'auto_redacted' }),
      makeSpan({ start: 40, end: 51, text: '111-11-1111', type: 'SSN', status: 'hidden_by_user' }),
      makeSpan({
        start: 57,
        end: 62,
        text: 'Alice',
        type: 'NAME',
        source: 'semantic',
        status: 'kept_visible',
        routedTo: 'review',
      }),
    ];

    for (const mode of ['anonymize', 'redact'] as const) {
      const result = buildExport(text, spans, mode);
      for (const raw of ['415-555-7731', 'a@b.com', '111-11-1111']) {
        expect(result.text).not.toContain(raw);
        expect(JSON.stringify(result.segments)).not.toContain(raw);
      }
      expect(result.text).toContain('Alice'); // a kept span stays — by the human's explicit choice
      expect(result.redactedCount).toBe(3);
      expect(result.visibleCount).toBe(1);
    }
  });
});

describe('summarizeRemaining — the felt-accountability count (D8)', () => {
  const remaining = (category: RemainingSpan['category'], type: string): RemainingSpan => ({
    type,
    text: 'x',
    start: 0,
    end: 1,
    category,
    reason: '',
  });

  it('reads "Nothing will remain visible" when the export is fully clean', () => {
    expect(summarizeRemaining([])).toMatch(/^Nothing will remain visible/);
  });

  it('names a single remaining item with an article and friendly noun', () => {
    expect(summarizeRemaining([remaining('kept', 'NAME')])).toBe(
      '1 item will remain visible: a name you kept.',
    );
    expect(summarizeRemaining([remaining('undecided', 'EMAIL')])).toBe(
      "1 item will remain visible: an email you haven't reviewed yet.",
    );
  });

  it('matches the CLAUDE.md example phrasing: a kept name + two unflagged things', () => {
    const summary = summarizeRemaining([
      remaining('kept', 'NAME'),
      remaining('left_visible', 'DATE'),
      remaining('left_visible', 'ORG'),
    ]);
    expect(summary).toBe(
      '3 items will remain visible: a name you kept, and 2 things nothing flagged.',
    );
  });
});
