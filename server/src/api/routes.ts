import { Router, raw } from 'express';
import { sampleDocument, sampleSemanticFindings } from '../../../fixtures/sample-document';
import { reconcile, route, group, buildExport, locateSpans } from '../domain';
import type { ExportMode, Span } from '../domain';
import { deterministicDetector, semanticDetector } from '../detection';
import { extractPdfText } from '../documents/extractText';
import { renderProcessedPdf } from '../documents/renderPdf';

/**
 * Thin API (CLAUDE.md §5). Contains NO product logic — it only wires HTTP to the detection,
 * domain, and document-I/O layers. The real thinking lives in the pure domain core. The document
 * lives only in memory: the client holds the extracted text and the spans and passes them back,
 * so there is no server-side store, no persistence, no auth (CLAUDE.md §11/§12).
 */
export const api = Router();

/** Hello-world health check — proves the frontend ↔ backend wiring end to end. */
api.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'conseal-review', message: 'Conseal Review backend is running.' });
});

/** Convenience for trying the app without a PDF on hand — loads the canonical sample text. */
api.get('/sample', (_req, res) => {
  res.json({ text: sampleDocument });
});

/**
 * STEP 1 — Upload. Accept a text-based PDF (raw bytes) and return its extracted text. A scanned /
 * image-only PDF has no selectable text; we say so clearly (OCR is out of scope this milestone —
 * D11) rather than failing silently. Nothing is stored.
 */
api.post('/upload', raw({ type: 'application/pdf', limit: '25mb' }), async (req, res) => {
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    res.status(400).json({ error: 'empty', message: 'No PDF was received. Please choose a file.' });
    return;
  }
  try {
    const extraction = await extractPdfText(new Uint8Array(bytes));
    if (!extraction.ok) {
      res.status(422).json({
        error: 'no_text',
        message:
          'This PDF has no selectable text — it looks scanned or image-based. Scanned documents ' +
          'need OCR, which this version does not support yet. Try a text-based PDF.',
      });
      return;
    }
    res.json({ text: extraction.text });
  } catch {
    res
      .status(400)
      .json({ error: 'unreadable', message: 'That file could not be read as a PDF.' });
  }
});

/**
 * STEP 3 — Detection pipeline (unchanged). Layer 1 (deterministic) + Layer 2 (semantic) run
 * independently, then reconcile → group → route. If the local model is unavailable, the sample
 * keeps its contextual review lane populated via the Mock findings (CLAUDE.md §5).
 * Detection is mode-independent: the output mode only affects how the export is rendered later.
 */
api.post('/detect', async (req, res) => {
  const text: string = typeof req.body?.text === 'string' ? req.body.text : '';

  const deterministic = await deterministicDetector.detect(text);
  let semantic = await semanticDetector.detect(text);
  if (semantic.length === 0 && text === sampleDocument) {
    semantic = locateSpans(text, sampleSemanticFindings); // demo-day fallback, sample only
  }

  const spans = route(group(reconcile(deterministic, semantic)));
  res.json({ text, spans });
});

/**
 * STEP 6 — Preview. Build the processed document from the CURRENT spans + chosen mode and return
 * the structured result (segments + the felt-accountability count). This is the SAME buildExport
 * the export uses — the preview just doesn't render bytes (D8).
 */
api.post('/preview', (req, res) => {
  res.json(buildExport(textOf(req.body), spansOf(req.body), modeOf(req.body)));
});

/**
 * STEP 7 — Export. Build the SAME processed segments, then render them to a real PDF respecting the
 * mode (semantic labels, or genuine black redaction boxes). What ships is what was previewed.
 */
api.post('/export', async (req, res) => {
  const result = buildExport(textOf(req.body), spansOf(req.body), modeOf(req.body));
  const pdf = await renderProcessedPdf(result.segments, result.mode);
  res
    .status(200)
    .setHeader('Content-Type', 'application/pdf')
    .setHeader('Content-Disposition', `attachment; filename="processed-${result.mode}.pdf"`)
    .send(Buffer.from(pdf));
});

const textOf = (body: unknown): string =>
  typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text : '';
const spansOf = (body: unknown): Span[] =>
  Array.isArray((body as { spans?: unknown })?.spans) ? (body as { spans: Span[] }).spans : [];
const modeOf = (body: unknown): ExportMode =>
  (body as { mode?: unknown })?.mode === 'anonymize' ? 'anonymize' : 'redact';
