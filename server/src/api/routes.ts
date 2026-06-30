import { Router } from 'express';
import { sampleDocument } from '../../../fixtures/sample-document';
import { reconcile, route, group, buildExport } from '../domain';
import { deterministicDetector, semanticDetector, mockDetector } from '../detection';

/**
 * Thin API (CLAUDE.md §5). Contains NO product logic — it only wires HTTP to the detection +
 * domain layers and hands their results back. All the thinking lives in the pure domain core.
 */
export const api = Router();

/** Hello-world health check — proves the frontend ↔ backend wiring end to end. */
api.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'conseal-review', message: 'Conseal Review backend is running.' });
});

/** Serve the canonical sample document for the demo. */
api.get('/document', (_req, res) => {
  res.json({ text: sampleDocument });
});

/**
 * Run the pipeline over a document and return the routed spans + the clean export. Layer 1
 * (deterministic) auto-redacts structured PII; Layer 2 (semantic) returns [] when the local model
 * is unavailable, so this endpoint always works end to end. The wiring is:
 * detect (Layer 1 + Layer 2) → reconcile → group → route → exportBuilder.
 */
api.post('/detect', async (req, res) => {
  const text: string = typeof req.body?.text === 'string' ? req.body.text : sampleDocument;

  // Detectors run independently on the same text (CLAUDE.md §6). Mock stands in if needed.
  void mockDetector; // available as a demo-day fallback; not wired into the happy path yet.
  const deterministic = await deterministicDetector.detect(text);
  const semantic = await semanticDetector.detect(text);

  const merged = reconcile(deterministic, semantic);
  const grouped = group(merged);
  const routed = route(grouped);
  const exported = buildExport(text, routed);

  res.json({ spans: routed, export: exported });
});
