import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DocSegment, ExportMode } from '../domain/exportBuilder';

/**
 * PDF rendering (infrastructure adapter). Draws the processed document from the domain's pure
 * `segments` — the SAME segments the preview shows — so the exported file represents what the user
 * previewed (D8).
 *
 * The processing is GENUINE, not a CSS overlay (D9):
 *   - 'anonymize' → a removed span is drawn as its label text, e.g. "[NAME]".
 *   - 'redact'    → a removed span's text is never written at all; a solid black box is drawn in its
 *                   place (legal/FBI-style). The PII bytes simply do not exist in the output.
 *
 * Monospace (Courier) keeps boxes aligned and gives the redacted output its document-like feel.
 * I/O-bearing on purpose; it holds no routing logic.
 */

const PAGE: [number, number] = [612, 792]; // US Letter
const MARGIN = 56;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;

export async function renderProcessedPdf(
  segments: DocSegment[],
  mode: ExportMode,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const charWidth = font.widthOfTextAtSize('M', FONT_SIZE); // monospace → every glyph is this wide

  const left = MARGIN;
  const right = PAGE[0] - MARGIN;
  const top = PAGE[1] - MARGIN;
  const bottom = MARGIN;

  let page: PDFPage = doc.addPage(PAGE);
  let x = left;
  let y = top;

  const newline = () => {
    x = left;
    y -= LINE_HEIGHT;
    if (y < bottom) {
      page = doc.addPage(PAGE);
      y = top;
    }
  };

  const drawWord = (word: string) => {
    const width = font.widthOfTextAtSize(word, FONT_SIZE);
    if (x + width > right && x > left) newline();
    page.drawText(word, { x, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    x += width;
  };

  const drawSpace = (count: number) => {
    const width = charWidth * count;
    if (x + width > right) newline();
    else x += width;
  };

  // A solid redaction box, wrapping across lines if it is wider than the remaining space.
  const drawBox = (totalWidth: number) => {
    let remaining = totalWidth;
    while (remaining > 0) {
      if (x >= right - 1) newline();
      const w = Math.min(remaining, right - x);
      page.drawRectangle({
        x,
        y: y - FONT_SIZE * 0.2,
        width: w,
        height: FONT_SIZE,
        color: rgb(0, 0, 0),
      });
      x += w;
      remaining -= w;
      if (remaining > 0) newline();
    }
  };

  for (const segment of segments) {
    if (segment.kind === 'redacted') {
      if (mode === 'anonymize') drawWord(`[${segment.type}]`);
      else drawBox(charWidth * segment.length);
      continue;
    }
    // Kept text: lay it out word by word, preserving spaces and line breaks.
    for (const item of tokenize(toWinAnsi(segment.text))) {
      if (item.kind === 'newline') newline();
      else if (item.kind === 'space') drawSpace(item.count);
      else drawWord(item.text);
    }
  }

  return doc.save();
}

type Token =
  | { kind: 'word'; text: string }
  | { kind: 'space'; count: number }
  | { kind: 'newline' };

/** Split kept text into words, runs of spaces, and explicit line breaks (for word-wrap). */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const lines = text.replace(/\t/g, '  ').split('\n');
  lines.forEach((line, i) => {
    if (i > 0) tokens.push({ kind: 'newline' });
    for (const part of line.split(/( +)/)) {
      if (part.length === 0) continue;
      if (part[0] === ' ') tokens.push({ kind: 'space', count: part.length });
      else tokens.push({ kind: 'word', text: part });
    }
  });
  return tokens;
}

/** Map common Unicode punctuation to ASCII and drop anything the Courier WinAnsi font can't draw,
 *  so a stray glyph in an uploaded PDF can never crash the export. */
function toWinAnsi(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\t\n\r\x20-\xFF]/g, '?');
}
