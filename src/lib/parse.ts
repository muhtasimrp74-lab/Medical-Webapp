/**
 * Turns the raw page paragraphs into typed reader blocks. Pure functions (no DOM) so the same
 * code runs in the UI, in the search worker and in tests. The JSON itself is never modified:
 * every Part keeps (pi, off) so highlights anchor to raw-paragraph character offsets.
 */
import type { Block, Em, OutlineItem, ParsedChapter, ParsedPage, Part, RawChapter, RawPage, ChapterId } from './types';
import { BOLD_ABBR_RE, BOLD_RE, GENE_RE, LATIN_RE, ORGANISM_RE } from './lexicon';

/* ── running headers: "84 CHAPTER 3 Inflammation and Repair" / "CHAPTER 3 Inflammation and Repair 85" ── */
export function isRunningHeader(s: string): boolean {
  const t = s.trim();
  if (t.length > 110) return false;
  return (
    /^\d{1,4}\s+CHAPTER\s+\S+\s+\S.*$/.test(t) ||
    /^CHAPTER\s+\S+\s+\S.*\s\d{1,4}$/.test(t) ||
    /^CHAPTER\s+\S{1,3}$/.test(t)
  );
}

const LABELS = new Set(['MORPHOLOGY', 'KEY CONCEPTS']);
const SMALL = new Set(['of', 'and', 'in', 'the', 'to', 'for', 'with', 'by', 'on', 'a', 'an', 'or', 'vs', 'as', 'from', 'at', 'into', 'versus', 'via', 'and/or']);
const TERMINAL = /[.!?:;)\]”"’]$/;
const isOpen = (s: string) => !TERMINAL.test(s.trim());
const startsLower = (s: string) => /^[a-z]/.test(s) || /^[-–]\w/.test(s);

export function headingLevel(t: string, prevOpen: boolean): 0 | 2 | 3 {
  if (t.length < 3 || t.length > 90) return 0;
  if (/[.,;:!?]$/.test(t) || t.includes(' | ')) return 0;
  if (!/^[A-Z]/.test(t)) return 0;
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return 0;
  const words = t.split(/\s+/);
  if (/\b(MD|PhD|Mayo|Courtesy)\b/.test(t)) return 0;
  if (letters === letters.toUpperCase()) return letters.length >= 4 && words.length <= 9 && t.length <= 80 ? 2 : 0;
  if (t.length > 72 || words.length > 10) return 0;
  const sig = words.map((w) => w.replace(/^[("'“]+/, '')).filter((w) => /^[A-Za-z]/.test(w) && !SMALL.has(w.toLowerCase()));
  const titleCase = sig.length > 0 && sig.every((w) => /^[A-Z]/.test(w));
  if (titleCase) return !prevOpen || words.length >= 2 ? 3 : 0;
  return !prevOpen && words.length <= 6 ? 3 : 0;
}

const mk = (pageId: string, pi: number, raw: string, off = 0): Part => ({ pageId, pi, off, text: raw.slice(off) });
export const partsText = (parts: Part[]) => parts.map((p) => p.text).join(' ');
/** Words that were split by a column/line break ("Gain-of" + "-function") are rejoined without a space. */
export const joiner = (next: Part) => (/^[-–]\w/.test(next.text) ? '' : ' ');

function cleanTable(t: string[][]): string[][] | null {
  let rows = t.map((r) => r.map((c) => (c ?? '').replace(/\s+/g, ' ').replace(/([a-z])- ([a-z])/g, '$1$2').trim()));
  rows = rows.filter((r) => r.some(Boolean));
  const w = Math.max(0, ...rows.map((r) => r.length));
  rows = rows.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? ''));
  const keep = Array.from({ length: w }, (_, c) => rows.some((r) => r[c]));
  rows = rows.map((r) => r.filter((_, c) => keep[c]));
  return rows.length >= 2 && (rows[0]?.length ?? 0) >= 2 ? rows : null;
}

const looksLikeContents = (s: string) =>
  /^[A-Z]/.test(s) && s.length < 240 && (/,\s*\d{1,4}\s*$/.test(s) || (s.match(/,\s*\d{1,4}(?=\s|$)/g) ?? []).length >= 2);

/** stray 1–2 letter fragments left over from figure/column extraction */
const isJunk = (s: string) => s.length <= 2 && /^[a-zA-Z]$|^[a-z]{2}$/.test(s) && s !== 'A';

export interface PageState { prevOpen: boolean }

export function parsePage(page: RawPage, state: PageState = { prevOpen: false }): { page: ParsedPage; blocks: Block[] } {
  const paras = page.paragraphs ?? [];
  const opener = page.kind === 'chapter_opener';
  const blocks: Block[] = [];
  const skip = new Set<number>();
  const figLines = (page.figure_text ?? []).map((x) => x.toLowerCase());
  const figTokens = new Set(figLines.flatMap((x) => x.split(/\s+/)));
  /** Short lines that are really labels read from inside a figure must not become headings. */
  const isFigFragment = (t: string) => {
    const l = t.toLowerCase();
    if (figLines.some((f) => f.includes(l))) return true;
    const tok = l.split(/\s+/);
    return tok.length <= 5 && tok.every((w) => figTokens.has(w));
  };
  let last: Block | null = null;
  let prevOpen = state.prevOpen;
  let tcapMerged = false;

  for (let pi = 0; pi < paras.length; pi++) {
    if (skip.has(pi)) continue;
    const raw = paras[pi];
    const s = raw.trim();
    if (!s || isRunningHeader(s) || isJunk(s)) continue;

    if (opener) {
      if (pi === 0 && /^\d{1,2}$/.test(s) && paras[1]?.trim()) {
        blocks.push({ t: 'hero', key: `${page.id}:hero`, number: s, title: paras[1].trim() });
        skip.add(1);
        continue;
      }
      if (/^C\s?H\s?A\s?P\s?T\s?E\s?R\s+C\s?O\s?N\s?T\s?E\s?N\s?T\s?S/i.test(s)) continue;
      if (looksLikeContents(s)) continue; // two-column table of contents: noise, the outline replaces it
    }

    const key = `${page.id}:${pi}`;
    const bullet = raw.match(/^\s*•\s*/);
    if (bullet) {
      const b: Block = { t: 'li', key, parts: [mk(page.id, pi, raw, bullet[0].length)] };
      blocks.push(b); last = b; prevOpen = isOpen(s); tcapMerged = false; continue;
    }
    const num = s.match(/^(\d{1,2})\.\s+\S/);
    if (num) {
      const b: Block = { t: 'li', key, num: num[1], parts: [mk(page.id, pi, raw)] };
      blocks.push(b); last = b; prevOpen = isOpen(s); tcapMerged = false; continue;
    }
    const fig = raw.match(/^\s*Fig\.\s*(\d+(?:\.\d+)?[A-Za-z]?)\s*/);
    if (fig) {
      const b: Block = { t: 'fig', key, parts: [mk(page.id, pi, raw, fig[0].length)], figLabel: `Figure ${fig[1]}`, figId: fig[1] };
      blocks.push(b); last = b; prevOpen = isOpen(s); tcapMerged = false; continue;
    }
    const tc = raw.match(/^\s*TABLE\s+(\d+\.\d+)\s*/i);
    if (tc) {
      const b: Block = { t: 'tcap', key, parts: [mk(page.id, pi, raw, tc[0].length)], tableId: tc[1] };
      blocks.push(b); last = b; prevOpen = isOpen(s); tcapMerged = false; continue;
    }
    if (LABELS.has(s)) {
      const b: Block = { t: 'label', key, parts: [mk(page.id, pi, raw)] };
      blocks.push(b); last = null; prevOpen = false; tcapMerged = false; continue;
    }

    /* continuation of the previous block (wrapped line, split across columns) */
    if (last && (last.t === 'p' || last.t === 'li') && (startsLower(s) || (prevOpen && /^\(/.test(s)))) {
      last.parts.push(mk(page.id, pi, raw)); prevOpen = isOpen(s); continue;
    }
    if (last && last.t === 'fig' && startsLower(s) && isOpen(partsText(last.parts))) {
      last.parts.push(mk(page.id, pi, raw)); prevOpen = isOpen(s); continue;
    }
    if (last && last.t === 'tcap' && !tcapMerged && s.length <= 60 && !/[.]$/.test(s) && partsText(last.parts).length < 160 && isOpen(partsText(last.parts))) {
      last.parts.push(mk(page.id, pi, raw)); tcapMerged = true; prevOpen = false; continue;
    }

    let lvl = headingLevel(s, prevOpen && !!last);
    if (lvl && (isFigFragment(s) || (opener && lvl === 3))) lvl = 0;
    if (lvl) {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === 'h' && prev.level === 2 && lvl === 2 && /\b(AND|OF|THE|IN|OR|FOR|TO|WITH|BY)$/.test(prev.text)) {
        prev.parts.push(mk(page.id, pi, raw)); prev.text += ' ' + s; continue;
      }
      blocks.push({ t: 'h', key, level: lvl, parts: [mk(page.id, pi, raw)], text: s });
      last = null; prevOpen = false; tcapMerged = false; continue;
    }

    const prevBlock = blocks[blocks.length - 1];
    const cont = startsLower(s) && (!prevBlock || prevBlock.t === 'h' || prevBlock.t === 'label' || prevBlock.t === 'fig' || prevBlock.t === 'table' || prevBlock.t === 'tcap');
    const b: Block = { t: 'p', key, parts: [mk(page.id, pi, raw)], cont: cont || undefined };
    blocks.push(b); last = b; prevOpen = isOpen(s); tcapMerged = false;
  }

  /* tables: place after their "TABLE x.y" caption, else at the end of the page */
  if (!opener) {
    const used = new Set<number>();
    (page.tables_extracted ?? []).forEach((raw, i) => {
      const rows = cleanTable(raw);
      if (!rows) return;
      const id = page.tables?.[i];
      let at = blocks.findIndex((b, bi) => b.t === 'tcap' && !used.has(bi) && b.tableId === id);
      if (at < 0) at = blocks.findIndex((b, bi) => b.t === 'tcap' && !used.has(bi) && !blocks.some((x) => x.t === 'table' && x.tableId === (b as { tableId?: string }).tableId));
      const tb: Block = { t: 'table', key: `${page.id}:t${i}`, rows, tableId: id };
      if (at >= 0) { blocks.splice(at + 1, 0, tb); used.add(at); } else blocks.push(tb);
    });
  }

  state.prevOpen = prevOpen;
  return {
    page: { id: page.id, pdfPage: page.pdf_page, bookPage: page.book_page ?? null, label: page.book_page != null ? String(page.book_page) : `pdf ${page.pdf_page}`, kind: page.kind },
    blocks,
  };
}

const isFloat = (b: Block) => b.t === 'fig' || b.t === 'tcap' || b.t === 'table';
const textOf = (b: Block) => ('parts' in b ? partsText(b.parts) : '');

/**
 * Joins the pages into one continuous flow:
 *  - a paragraph/bullet that breaks across a page boundary becomes ONE paragraph (the page anchor sits inside it)
 *  - figure/table boxes never interrupt a sentence: they are held back until the paragraph they landed in has ended
 */
export function stitch(pages: { page: ParsedPage; blocks: Block[] }[]): Block[] {
  const out: Block[] = [];
  let held: Block[] = [];
  let carry: string[] = [];
  for (const { page, blocks } of pages) {
    carry.push(page.id);
    for (const b of blocks) {
      const last = out[out.length - 1];
      if (isFloat(b)) {
        if (carry.length) { b.pageStarts = carry; carry = []; }
        const open = !!last && (last.t === 'p' || last.t === 'li') && isOpen(textOf(last));
        if (held.length || open) held.push(b); else out.push(b);
        continue;
      }
      const boundary = carry.length > 0;
      if (last && (last.t === 'p' || last.t === 'li') && b.t === 'p' &&
          (startsLower(b.parts[0].text) || ((boundary || held.length > 0) && isOpen(textOf(last)) && !/^\d{1,2}\.\s/.test(b.parts[0].text)))) {
        if (carry.length) { b.parts[0].pageStarts = carry; carry = []; }
        last.parts.push(...b.parts);
        continue; // floats stay held until this paragraph ends
      }
      out.push(...held); held = [];
      if (carry.length) { b.pageStarts = carry; carry = []; }
      out.push(b);
    }
  }
  out.push(...held);
  if (carry.length && out.length) out[out.length - 1].pageStarts = [...(out[out.length - 1].pageStarts ?? []), ...carry];
  return out;
}

/** Exam-oriented bold/italic. Bold: first mention per page only, max 2 per paragraph part and 4 per page; none on chapter-opener intros. */
function emphasize(blocks: Block[], pages: ParsedPage[]) {
  const seen = new Map<string, Set<string>>();
  const perPage = new Map<string, number>();
  const opener = new Set(pages.filter((p) => p.kind === 'chapter_opener').map((p) => p.id));
  for (const b of blocks) {
    if (b.t !== 'p' && b.t !== 'li') continue;
    for (const part of b.parts) {
      const onOpener = opener.has(part.pageId);
      const em: Em[] = [];
      const taken = (s: number, e: number) => em.some((x) => s < x.e && e > x.s);
      const add = (re: RegExp, k: 'b' | 'i', gate?: (m: string) => boolean) => {
        re.lastIndex = 0;
        for (let m = re.exec(part.text); m; m = re.exec(part.text)) {
          const s = m.index, e = s + m[0].length;
          if (e === s) { re.lastIndex++; continue; }
          if (taken(s, e) || (gate && !gate(m[0]))) continue;
          em.push({ s, e, k });
        }
      };
      add(ORGANISM_RE, 'i'); add(GENE_RE, 'i'); add(LATIN_RE, 'i');
      let n = 0;
      const set = seen.get(part.pageId) ?? new Set<string>();
      seen.set(part.pageId, set);
      const gate = (m: string) => {
        const key = m.toLowerCase().replace(/(es|s)$/, '');
        const used = perPage.get(part.pageId) ?? 0;
        if (onOpener || n >= 2 || used >= 4 || set.has(key)) return false;
        set.add(key); n++; perPage.set(part.pageId, used + 1); return true;
      };
      add(BOLD_RE, 'b', gate); add(BOLD_ABBR_RE, 'b', gate);
      if (em.length) part.em = em.sort((x, y) => x.s - y.s);
    }
  }
}

export function parseChapter(raw: RawChapter, id: ChapterId, fallbackTitle: string): ParsedChapter {
  const state: PageState = { prevOpen: false };
  const parsed = raw.pages.map((p) => parsePage(p, state));
  const pages = parsed.map((x) => x.page);
  const blocks = stitch(parsed);
  emphasize(blocks, pages);
  const idx = new Map(pages.map((p, i) => [p.id, i]));
  const outline: OutlineItem[] = [];
  for (const b of blocks) {
    if (b.t === 'h' && b.text.length >= 4) {
      const pid = b.parts[0].pageId;
      const i = idx.get(pid) ?? 0;
      outline.push({ key: b.key, text: b.text, level: b.level, pageId: pid, pageIdx: i, label: pages[i].label });
    }
  }
  return { id, number: raw.chapter_number ?? null, title: raw.title ?? fallbackTitle, pages, blocks, outline };
}
