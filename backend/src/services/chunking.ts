import type { ExtractedSection } from './textExtraction.js';

export interface Chunk {
  content: string;
  section: string | null;
}

/**
 * Paragraph-aware sliding-window chunker — pure function, no I/O.
 * Character-based (not token-based) to avoid a tokenizer dependency for a
 * first pass; `chunkSize`/`chunkOverlap` are configured via
 * config.chunkSize/chunkOverlap. Packs whole paragraphs into a chunk up to
 * `chunkSize` chars, carries the trailing `chunkOverlap` chars of each
 * chunk into the start of the next one, and hard-splits any single
 * paragraph that alone exceeds `chunkSize`.
 */
export function chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  function pushCurrent() {
    if (current.trim()) chunks.push(current.trim());
  }

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      pushCurrent();
      current = '';
      let start = 0;
      while (start < para.length) {
        const end = Math.min(start + chunkSize, para.length);
        chunks.push(para.slice(start, end));
        if (end >= para.length) break;
        start = end - chunkOverlap;
      }
      continue;
    }

    if (current.length + para.length + 2 > chunkSize) {
      pushCurrent();
      const prevChunk = chunks[chunks.length - 1] ?? '';
      const overlapText = prevChunk.slice(Math.max(0, prevChunk.length - chunkOverlap));
      current = overlapText ? `${overlapText}\n\n${para}` : para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  pushCurrent();

  return chunks;
}

/** Chunks each extracted section independently, so no chunk crosses a page/heading boundary. */
export function chunkSections(
  sections: ExtractedSection[],
  chunkSize: number,
  chunkOverlap: number,
): Chunk[] {
  return sections.flatMap((s) =>
    chunkText(s.text, chunkSize, chunkOverlap).map((content) => ({ content, section: s.section })),
  );
}
