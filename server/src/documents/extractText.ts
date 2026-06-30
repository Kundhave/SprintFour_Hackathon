import { PDFParse } from 'pdf-parse';

/**
 * PDF text extraction (infrastructure adapter — I/O at the edge, like the detectors). It turns
 * uploaded bytes into the plain text the existing pipeline expects, and decides one product
 * question that belongs here: does this PDF actually contain selectable text?
 *
 * This milestone supports ONLY text-based PDFs (CLAUDE.md cut OCR deliberately — D11). A scanned /
 * image-only PDF yields no extractable text, so we report that clearly instead of failing silently
 * or pretending the document is empty.
 */
export type Extraction =
  | { ok: true; text: string }
  | { ok: false; reason: 'no_text' };

export async function extractPdfText(data: Uint8Array): Promise<Extraction> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    // Join clean per-page text (avoids the library's "-- n of m --" page footers).
    const text = result.pages
      .map((page) => page.text)
      .join('\n\n')
      .replace(/\r\n?/g, '\n')
      .trim();

    if (text.length === 0) return { ok: false, reason: 'no_text' };
    return { ok: true, text };
  } finally {
    await parser.destroy();
  }
}
