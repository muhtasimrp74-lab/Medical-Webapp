import { describe, it, expect } from 'vitest';
import MiniSearch from 'minisearch';
import { readFileSync } from 'node:fs';
import { isRunningHeader } from '../src/lib/parse';

const OPT = { idField: 'id', fields: ['text', 'chTitle'], storeFields: ['ch', 'chTitle', 'bookPage', 'label', 'text'] };
describe('search index over the whole book', () => {
  it('builds, serialises, reloads and finds things', () => {
    const t0 = Date.now();
    const ms = new MiniSearch(OPT);
    const files = ['front_matter.json', ...Array.from({ length: 29 }, (_, i) => `chapters/ch${String(i + 1).padStart(2, '0')}.json`), 'back_matter.json'];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
      ms.addAll(ch.pages.map((p: any) => ({ id: p.id, ch: f, chTitle: ch.title ?? f, bookPage: p.book_page, label: String(p.book_page ?? p.pdf_page),
        text: p.paragraphs.filter((x: string) => !isRunningHeader(x)).join(' ').replace(/\s+/g, ' ') })));
    }
    const json = JSON.stringify(ms);
    const t1 = Date.now();
    const re = MiniSearch.loadJSON(json, OPT);
    const t2 = Date.now();
    const hits = re.search('pyroptosis', { prefix: true });
    const t3 = Date.now();
    console.log(`docs=${re.documentCount} indexJSON=${(json.length / 1e6).toFixed(1)}MB build=${t1 - t0}ms load=${t2 - t1}ms query=${t3 - t2}ms`);
    expect(re.documentCount).toBeGreaterThan(1200);
    expect(hits.length).toBeGreaterThan(0);
    expect(re.search('leukocyte adhesion deficiency', { prefix: true, combineWith: 'AND' }).length).toBeGreaterThan(0);
  }, 120000);
});
