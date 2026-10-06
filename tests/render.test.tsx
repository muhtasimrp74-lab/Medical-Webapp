import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseChapter } from '../src/lib/parse';
import { BlockRow, ReaderCtx, blockParts } from '../src/components/Blocks';
import type { Annotation } from '../src/lib/types';

const render = (ch: ReturnType<typeof parseChapter>, annos: Annotation[] = []) => {
  const ctx = { pages: new Map(ch.pages.map((p) => [p.id, p])), bookmarked: new Set<string>(), openAnno() {}, toggleBookmark() {}, viewOriginal() {}, goRef() {} };
  return ch.blocks.map((b) => renderToString(<ReaderCtx.Provider value={ctx}><BlockRow b={b} annos={annos.filter((a) => a.segments.some((s) => blockParts(b).some((p) => p.pageId === s.pageId && p.pi === s.pi)))} sig={annos.map((a) => a.id).join()} find={/leukocyte/giu} findKey="leukocyte" bm="" /></ReaderCtx.Provider>)).join('');
};

describe('render', () => {
  it('renders ch03 with highlight, note, figure cards, tables, links, emphasis', () => {
    const ch = parseChapter(JSON.parse(readFileSync('public/data/chapters/ch03.json', 'utf8')), 'ch03', 'x');
    const pb = ch.blocks.find((b) => b.t === 'p' && b.parts.length > 0 && b.parts[0].pageId === ch.pages[3].id)! as { parts: { pageId: string; pi: number }[] };
    const a: Annotation = { id: 'a1', chapterId: 'ch03', pageId: pb.parts[0].pageId, bookPage: 67, pdfPage: 83, color: 'green', note: 'remember this', quote: 'q',
      segments: [{ pageId: pb.parts[0].pageId, pi: pb.parts[0].pi, start: 0, end: 10 }], created: 1, updated: 1 };
    const html = render(ch, [a]);
    expect(html).toContain('hl-green'); expect(html).toContain('remember this');
    expect(html).toContain('class="fig-card"'); expect(html).toContain('<table>');
    expect(html).toContain('class="xref"'); expect(html).toContain('<strong class="kt">');
    expect((html.match(/class="pg-anchor"/g) ?? []).length).toBe(ch.pages.length);
    expect(html).not.toMatch(/two columns|as extracted|Labels in figure/);
  });
});
