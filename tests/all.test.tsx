import { it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseChapter } from '../src/lib/parse';
import { PageSection } from '../src/components/Blocks';
it('renders every chapter', () => {
  const ids = ['front_matter.json', 'back_matter.json', ...Array.from({ length: 29 }, (_, i) => `chapters/ch${String(i + 1).padStart(2, '0')}.json`)];
  const bad: string[] = [];
  for (const f of ids) {
    try {
      const ch = parseChapter(JSON.parse(readFileSync(`public/data/${f}`, 'utf8')), f, f);
      ch.pages.forEach((p, i) => renderToString(<PageSection page={p} idx={i} annos={[]} sig="" find={null} findKey="" bookmarked={false} />));
    } catch (e) { bad.push(`${f}: ${(e as Error).message}`); }
  }
  expect(bad).toEqual([]);
}, 60000);
