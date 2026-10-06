import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isRunningHeader, parseChapter, headingLevel } from '../src/lib/parse';

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
  it('has no running headers left and joins wrapped lines', () => {
    const texts = ch.pages.flatMap((p) => p.blocks.flatMap((b) => ('parts' in b ? b.parts.map((x) => x.text) : [])));
    expect(texts.some(isRunningHeader)).toBe(false);
    const p67 = ch.pages.find((p) => p.bookPage === 67)!;
    const li = p67.blocks.find((b) => b.t === 'li' && b.parts[0].text.startsWith('Sensors of cell damage'))!;
    expect('parts' in li && li.parts.length).toBeGreaterThan(2);
  });
  it('builds an outline with both levels and places tables after captions', () => {
    expect(ch.outline.filter((o) => o.level === 2).length).toBeGreaterThan(5);
    expect(ch.outline.some((o) => o.text === 'Leukocyte Adhesion to Endothelium')).toBe(true);
    const p71 = ch.pages.find((p) => p.bookPage === 71)!;
    const i = p71.blocks.findIndex((b) => b.t === 'tcap');
    expect(p71.blocks[i + 1].t).toBe('table');
  });
  it('turns the opener into hero + contents', () => {
    const o = ch.pages[0].blocks;
    expect(o[0].t).toBe('hero'); expect(o[1].t).toBe('contents');
  });
});
describe('whole book parses without throwing', () => {
  it('all chapters', () => {
    let pages = 0, heads = 0;
    for (let n = 1; n <= 29; n++) {
      const id = `ch${String(n).padStart(2, '0')}`;
      const c = parseChapter(load(`chapters/${id}.json`), id, id);
      pages += c.pages.length; heads += c.outline.length;
      expect(c.pages.every((p) => p.blocks.length > 0)).toBe(true);
    }
    for (const f of ['front_matter.json', 'back_matter.json']) parseChapter(load(f), f, f);
    expect(pages).toBe(1209); expect(heads).toBeGreaterThan(1500);
  });
});
