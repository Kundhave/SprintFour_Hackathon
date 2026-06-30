/**
 * Sample document for demo + tests.
 *
 * This is the canonical input the app loads on "Load sample document". It is deliberately
 * seeded with a spread of PII so every router path is exercised end to end:
 *
 *   - STRUCTURED (deterministic detector → AUTO-REDACT):
 *       phone, email, SSN  — including the phone number the "original tool" is meant to MISS,
 *       which our deterministic layer catches with certainty.
 *   - CONTEXTUAL (semantic detector → HUMAN REVIEW, never auto-redacted):
 *       names, an organization, a mailing address, dates.
 *   - HARMLESS (agreed low-signal → LEFT VISIBLE, never surfaced):
 *       generic prose with no identifying content.
 *
 * Plain text only — no markup, no offsets. Detectors return strings; we locate them in this
 * source ourselves (see CLAUDE.md §9).
 */

import type { SemanticFinding } from '../server/src/domain/locate';

export const sampleDocument = `From: Sam Carter <sam.carter@northbridge-legal.com>
To: Intake Team
Subject: Client onboarding — file 4471

Hi team,

Please open a new matter for our client, Maria Gonzalez. She first contacted the
firm on March 3, 2024 and we should aim to have the engagement letter out by
April 12, 2024.

Her direct line is (415) 555-0192 and a secondary contact number is 415-555-7731.
Email her at maria.gonzalez@example.com for any scheduling. For the conflict check
her SSN on file is 412-55-9087.

Mailing address for correspondence:
1942 Marlowe Avenue, Apt 6B, San Francisco, CA 94110.

The opposing party is represented by Hatcher & Wynn LLP. Loop in our partner,
David Okafor, before responding to anything from them.

As always, keep the working notes in the shared folder and flag anything unusual.

Thanks,
Sam
`;

/**
 * Demo-day fallback (CLAUDE.md §5): the semantic findings the local LLM would return for the
 * sample document — strings + type + confidence, NO offsets (we locate them ourselves). The Mock
 * uses these so the contextual review lane is populated even when Ollama is unavailable. These are
 * contextual types, so the router always sends them to the human — never auto-redacted.
 */
export const sampleSemanticFindings: SemanticFinding[] = [
  { text: 'Sam Carter', type: 'NAME', confidence: 0.96 },
  { text: 'Maria Gonzalez', type: 'NAME', confidence: 0.95 },
  { text: 'David Okafor', type: 'NAME', confidence: 0.93 },
  { text: 'Hatcher & Wynn LLP', type: 'ORG', confidence: 0.9 },
  { text: '1942 Marlowe Avenue, Apt 6B, San Francisco, CA 94110', type: 'ADDRESS', confidence: 0.92 },
  { text: 'March 3, 2024', type: 'DATE', confidence: 0.78 },
  { text: 'April 12, 2024', type: 'DATE', confidence: 0.78 },
];

export default sampleDocument;
