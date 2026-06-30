import { describe, it, expect } from 'vitest';
import { reconcile, route, group, buildExport } from './index';
import { mockDetector } from '../detection/mock';

/**
 * Smoke test — proves Vitest runs and the domain pipeline is importable + wired.
 * Real behavioral tests (router rules, overlap resolution, export-integrity) land as the
 * domain logic is implemented. Domain is always tested via the Mock, never the live LLM.
 */
describe('pipeline wiring', () => {
  it('runs end to end on an empty detection result without throwing', async () => {
    const spans = await mockDetector().detect('hello world');
    const result = buildExport('hello world', route(group(reconcile(spans, []))));
    expect(result.text).toBe('hello world');
    expect(result.redactedCount).toBe(0);
  });
});
