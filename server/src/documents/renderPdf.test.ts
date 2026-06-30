import { describe, it, expect } from 'vitest';
import { buildExport } from '../domain';
import { makeSpan } from '../domain/testSpan';
import { renderProcessedPdf } from './renderPdf';
import { extractPdfText } from './extractText';

/**
 * End-to-end export integrity (CLAUDE.md §3, D8/D9): build the SAME segments the preview uses,
 * render them to a real PDF, then read the PDF back. The raw PII for redacted spans must be absent
 * from the actual exported bytes — proven by re-extraction, not by inspecting our own data.
 */
describe('renderProcessedPdf — exported PDF bytes never contain redacted PII', () => {
  const text = 'Call 415-555-7731 then ask for Alice today.';
  const spans = [
    makeSpan({ start: 5, end: 17, text: '415-555-7731', type: 'PHONE', status: 'auto_redacted' }),
    makeSpan({
      start: 31,
      end: 36,
      text: 'Alice',
      type: 'NAME',
      source: 'semantic',
      status: 'kept_visible',
      routedTo: 'review',
    }),
  ];

  it('redact mode: draws boxes — the phone number is nowhere in the extracted text', async () => {
    const result = buildExport(text, spans, 'redact');
    const pdf = await renderProcessedPdf(result.segments, result.mode);

    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-');
    const extraction = await extractPdfText(pdf);
    expect(extraction.ok).toBe(true);
    if (extraction.ok) {
      expect(extraction.text).not.toContain('415-555-7731');
      expect(extraction.text).toContain('Alice'); // a kept span stays
    }
  });

  it('anonymize mode: draws the [PHONE] label, never the raw number', async () => {
    const result = buildExport(text, spans, 'anonymize');
    const pdf = await renderProcessedPdf(result.segments, result.mode);

    const extraction = await extractPdfText(pdf);
    expect(extraction.ok).toBe(true);
    if (extraction.ok) {
      expect(extraction.text).not.toContain('415-555-7731');
      expect(extraction.text).toContain('[PHONE]');
      expect(extraction.text).toContain('Alice');
    }
  });
});
