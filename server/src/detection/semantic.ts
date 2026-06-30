import { z } from 'zod';
import type { Detector } from './detector';
import type { Span } from '../domain/types';
import { locateSpans, type SemanticFinding } from '../domain/locate';

/**
 * Layer 2 — Semantic detector: local LLM via Ollama (CLAUDE.md §6, §9, §11).
 *
 * Model: `gemma3n:e4b` (Gemma 3n, effective-4B variant), running locally. Nothing leaves the box.
 *
 * Contract (CLAUDE.md §9):
 *   - The model returns ONLY semantic PII (names, orgs, addresses, contextual ids) as
 *     { text, type, confidence } — NEVER offsets. We locate the strings in the source ourselves.
 *   - Output is validated with Zod. On malformed output: retry ONCE, then return [].
 *   - The pipeline must never crash on bad model output; Layer 1 (deterministic) still functions.
 */

export const OLLAMA_MODEL = 'gemma3n:e4b';
export const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const REQUEST_TIMEOUT_MS = 20_000;

/** The wire contract: strings + type + confidence. No offsets. */
const FindingSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['NAME', 'ORG', 'ADDRESS', 'DATE']),
  confidence: z.number().min(0).max(1),
});
const FindingsSchema = z.array(FindingSchema);

export const semanticDetector: Detector = {
  name: 'semantic',
  async detect(text: string): Promise<Span[]> {
    const findings = await extractFindings(text);
    // Offsets are produced by OUR pure domain code, never trusted from the model (CLAUDE.md §8/§9).
    return locateSpans(text, findings);
  },
};

/** Call Ollama, validate, retry ONCE on malformed output, then return [] (never throws). */
async function extractFindings(text: string): Promise<SemanticFinding[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callOllama(text);
      const parsed = parseFindings(raw);
      if (parsed) return parsed;
      // malformed → fall through and retry once
    } catch {
      // network / timeout / HTTP error → fall through and retry once, then give up
    }
  }
  return [];
}

async function callOllama(text: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildPrompt(text),
        stream: false,
        format: 'json',
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const body = (await res.json()) as { response?: string };
    return body.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse + normalize + validate the model's JSON into findings. Returns null on anything malformed
 * (so the caller can retry). Pure and exported so it is unit-testable without a live model.
 */
export function parseFindings(raw: string): SemanticFinding[] | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const list = asList(json);
  if (!list) return null;

  const normalized = list
    .map(normalizeItem)
    .filter((item): item is SemanticFinding => item !== null);

  const result = FindingsSchema.safeParse(normalized);
  return result.success ? result.data : null;
}

/** Accept a bare array or an object wrapping the array under a common key. */
function asList(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const key of ['items', 'findings', 'pii', 'results', 'entities']) {
      const value = (json as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return null;
}

const TYPE_SYNONYMS: Record<string, 'NAME' | 'ORG' | 'ADDRESS' | 'DATE'> = {
  NAME: 'NAME',
  PERSON: 'NAME',
  PER: 'NAME',
  ORG: 'ORG',
  ORGANIZATION: 'ORG',
  COMPANY: 'ORG',
  ADDRESS: 'ADDRESS',
  LOCATION: 'ADDRESS',
  LOC: 'ADDRESS',
  GPE: 'ADDRESS',
  DATE: 'DATE',
  TIME: 'DATE',
};

function normalizeItem(item: unknown): SemanticFinding | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;

  const text = typeof rec.text === 'string' ? rec.text.trim() : '';
  if (!text) return null;

  const rawType = typeof rec.type === 'string' ? rec.type.toUpperCase().trim() : '';
  const type = TYPE_SYNONYMS[rawType];
  if (!type) return null;

  return { text, type, confidence: coerceConfidence(rec.confidence) };
}

function coerceConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 0.5; // unknown → mid (the router will send it to a human)
  return Math.min(1, Math.max(0, n));
}

function buildPrompt(text: string): string {
  return [
    'You extract ONLY semantic PII from a document for a redaction tool.',
    'Return STRICT JSON of the form:',
    '{"items":[{"text":"<verbatim substring>","type":"<TYPE>","confidence":<number 0..1>}]}',
    'Allowed types: NAME (a person), ORG (an organization), ADDRESS (a mailing/physical address), DATE.',
    'Do NOT include phone numbers, emails, or SSNs — those are handled by a separate detector.',
    'Each "text" MUST be copied verbatim from the document. Do NOT include character offsets.',
    'If there is no semantic PII, return {"items":[]}.',
    '',
    'DOCUMENT:',
    text,
  ].join('\n');
}
