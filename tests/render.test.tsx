import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseChapter } from '../src/lib/parse';
import { PageSection } from '../src/components/Blocks';
import type { Annotation } from '../src/lib/types';

describe('render', () => {
  it('renders every page of ch03 (with a highlight and a note) without errors', () => {
    const ch = parseChapter(JSON.parse(readFileSync('public/data/chapters/ch03.json', 'utf8')), 'ch03', 'x');
    const pg = ch.pages[3];
    const firstPart = pg.blocks.find((b) => b.t === 'p' && b.parts.length)! as any;
    const pi = firstPart.parts[0].pi;
    const a: Annotation = { id: 'a1', chapterId: 'ch03', pageId: pg.id, bookPage: pg.bookPage, pdfPage: pg.pdfPage, color: 'green', note: 'remember this', quote: 'q',
      segments: [{ pageId: pg.id, pi, start: 0, end: 10 }], created: 1, updated: 1 };
    let html = '';
    ch.pages.forEach((p, i) => { html += renderToString(<PageSection page={p} idx={i} annos={p === pg ? [a] : []} sig="" find={/leukocyte/giu} findKey="leukocyte" bookmarked={i === 2} />); });
    expect(html).toContain('hl-green'); expect(html).toContain('remember this'); expect(html).toContain('class="fig-card"'); expect(html).toContain('<table>');
    expect(html).not.toMatch(/CHAPTER \d+ Inflammation/);
    console.log('ch03 html bytes', html.length);
  });
});
