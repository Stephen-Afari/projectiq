import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * One block of extracted text plus the section label chunking.ts should
 * tag every chunk cut from it with. `section` is a real page number for
 * PDF, the nearest Markdown heading for .md, and null for .txt/.docx —
 * DOCX has no reliable page/section boundary without full rendering, so
 * that's disclosed as null rather than guessed.
 */
export interface ExtractedSection {
  text: string;
  section: string | null;
}

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'md', 'markdown', 'txt'] as const;

export function extensionOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? '';
}

export async function extractText(buffer: Buffer, filename: string): Promise<ExtractedSection[]> {
  const ext = extensionOf(filename);
  switch (ext) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'md':
    case 'markdown':
      return sectionizeMarkdown(buffer.toString('utf-8'));
    case 'txt':
      return [{ text: buffer.toString('utf-8').trim(), section: null }].filter((s) => s.text.length > 0);
    default:
      throw new Error(`Unsupported document type: .${ext} (supported: ${SUPPORTED_EXTENSIONS.join(', ')})`);
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedSection[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages
      .map((p) => ({ text: p.text.trim(), section: `Page ${p.num}` }))
      .filter((s) => s.text.length > 0);
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractedSection[]> {
  const { value } = await mammoth.extractRawText({ buffer });
  const text = value.trim();
  return text ? [{ text, section: null }] : [];
}

/** Splits on Markdown headings (# .. ######), tagging each block with its heading text. */
function sectionizeMarkdown(text: string): ExtractedSection[] {
  const lines = text.split('\n');
  const sections: ExtractedSection[] = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  function flush() {
    const content = buffer.join('\n').trim();
    if (content) sections.push({ text: content, section: currentHeading });
    buffer = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1]!.trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections.length ? sections : [{ text: text.trim(), section: null }].filter((s) => s.text.length > 0);
}
