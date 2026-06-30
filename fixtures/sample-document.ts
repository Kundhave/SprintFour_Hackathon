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

export default sampleDocument;
