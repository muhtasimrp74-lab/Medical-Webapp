import { it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseChapter } from '../src/lib/parse';
import { BlockRow, ReaderCtx } from '../src/components/Blocks';
it('renders every chapter', () => {
  const ids = ['front_matter.json', 'back_matter.json', ...Array.from({ length: 29 }, (_, i) => `chapters/ch${String(i + 1).padStart(2, '0')}.json`)];
  const bad: string[] = [];
  for (const f of ids) {
    try {
      const ch = parseChapter(JSON.parse(readFileSync(`public/data/${f}`, 'utf8')), f, f);
      const ctx = { pages: new Map(ch.pages.map((p) => [p.id, p])), bookmarked: new Set<string>(), openAnno() {}, toggleBookmark() {}, viewOriginal() {}, goRef() {} };
      ch.blocks.forEach((b) => renderToString(<ReaderCtx.Provider value={ctx}><BlockRow b={b} annos={[]} sig="" find={null} findKey="" bm="" /></ReaderCtx.Provider>));
    } catch (e) { bad.push(`${f}: ${(e as Error).message}`); }
  }
  expect(bad).toEqual([]);
}, 60000);
