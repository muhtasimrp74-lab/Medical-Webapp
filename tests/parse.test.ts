import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isRunningHeader, parseChapter, headingLevel, partsText } from '../src/lib/parse';
import { refMarks } from '../src/lib/segments';

const load = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));

describe('running headers', () => {
  it('detects both layouts, incl. garbled subscripts', () => {
    expect(isRunningHeader('84 CHAPTER 3 Inflammation and Repair')).toBe(true);
    expect(isRunningHeader('CHAPTER 3 Inflammation and Repair 85')).toBe(true);
    expect(isRunningHeader('304 CHAPTER ₈ Infectious Diseases')).toBe(true);
    expect(isRunningHeader('CHAPTER 2')).toBe(true);
    expect(isRunningHeader('Inflammation is a response of vascularized tissues.')).toBe(false);
  });
});
describe('headings', () => {
  it('classifies', () => {
    expect(headingLevel('ACUTE INFLAMMATION', false)).toBe(2);
    expect(headingLevel('Leukocyte Adhesion to Endothelium', true)).toBe(3);
    expect(headingLevel('leukocytes to the site where the offending agent is located.', false)).toBe(0);
    expect(headingLevel('Increased Vascular Permeability (Vascular Leakage)', false)).toBe(3);
  });
});
describe('chapter 3', () => {
  const ch = parseChapter(load('chapters/ch03.json'), 'ch03', 'x');
  const parts = ch.blocks.flatMap((b) => ('parts' in b ? b.parts : []));
  it('has no running headers left and joins wrapped lines', () => {
    expect(parts.some((p) => isRunningHeader(p.text))).toBe(false);
    const li = ch.blocks.find((b) => b.t === 'li' && b.parts[0].text.startsWith('Sensors of cell damage'))!;
    expect('parts' in li && li.parts.length).toBeGreaterThan(2);
  });
  it('builds an outline with both levels and keeps tables right after their captions', () => {
    expect(ch.outline.filter((o) => o.level === 2).length).toBeGreaterThan(5);
    expect(ch.outline.some((o) => o.text === 'Leukocyte Adhesion to Endothelium')).toBe(true);
    const i = ch.blocks.findIndex((b) => b.t === 'tcap' && b.tableId === '3.3');
    expect(ch.blocks[i + 1].t).toBe('table');
  });
  it('turns the opener into a hero and drops the two-column contents', () => {
    expect(ch.blocks[0].t).toBe('hero');
    expect(ch.blocks.some((b) => (b as { t: string }).t === 'contents')).toBe(false);
  });
  it('keeps a paragraph whole across a page break (anchor inside the paragraph)', () => {
    const span = ch.blocks.filter((b) => 'parts' in b && b.parts.some((p, i) => i > 0 && p.pageStarts?.length));
    expect(span.length).toBeGreaterThan(3);
    const b = span[0] as { parts: { pageStarts?: string[]; text: string }[] };
    const k = b.parts.findIndex((p, i) => i > 0 && p.pageStarts?.length);
    expect(b.parts[k - 1].text.trim()).not.toMatch(/[.!?]$/); // it really was mid-sentence
  });
  it('every page has exactly one anchor', () => {
    const ids = ch.blocks.flatMap((b) => [...(b.pageStarts ?? []), ...('parts' in b ? b.parts.flatMap((p) => p.pageStarts ?? []) : [])]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(ch.pages.length);
  });
  it('figure boxes rarely interrupt a sentence', () => {
    let bad = 0, n = 0;
    ch.blocks.forEach((b, i) => { if (b.t !== 'fig') return; n++; const p = ch.blocks[i - 1]; if (p && (p.t === 'p' || p.t === 'li') && !/[.!?:;)\]”"’]$/.test(partsText(p.parts).trim())) bad++; });
    expect(bad / n).toBeLessThan(0.2);
  });
  it('adds exam emphasis: bold terms, italic organisms/genes', () => {
    const em = parts.flatMap((p) => (p.em ?? []).map((e) => `${e.k}:${p.text.slice(e.s, e.e).toLowerCase()}`));
    expect(em).toContain('b:chemotaxis');
    expect(em.filter((x) => x.startsWith('b:')).length / ch.pages.length).toBeLessThan(6);
  });
});
describe('cross references', () => {
  it('finds figures, tables and chapters, including lists', () => {
    const r = (t: string) => refMarks(t, 0).map((m) => [t.slice(m.start, m.end), m.ref]);
    expect(r('shown in Fig. 3.4 and Table 3.2.')).toEqual([['Fig. 3.4', 'fig:3.4'], ['Table 3.2', 'tbl:3.2']]);
    expect(r('(Figs. 3.4, 3.5 and 3.6A)')).toEqual([['Figs. 3.4', 'fig:3.4'], ['3.5', 'fig:3.5'], ['3.6A', 'fig:3.6']]);
    expect(r('see Chapters 5 and 6')).toEqual([['Chapters 5', 'ch:5'], ['6', 'ch:6']]);
    expect(r('Figure 12.10 shows')).toEqual([['Figure 12.10', 'fig:12.10']]);
  });
});
describe('whole book parses without throwing', () => {
  it('all chapters', () => {
    let pages = 0, heads = 0;
    for (let n = 1; n <= 29; n++) {
      const id = `ch${String(n).padStart(2, '0')}`;
      const c = parseChapter(load(`chapters/${id}.json`), id, id);
      pages += c.pages.length; heads += c.outline.length;
      expect(c.blocks.length).toBeGreaterThan(c.pages.length);
    }
    for (const f of ['front_matter.json', 'back_matter.json']) parseChapter(load(f), f, f);
    expect(pages).toBe(1209); expect(heads).toBeGreaterThan(1500);
  });
});
