import type { HlColor } from './types';

export interface Mark { start: number; end: number; order: number; annoId?: string; color?: HlColor; note?: boolean; find?: boolean; k?: 'b' | 'i'; ref?: string }
export interface Seg { text: string; annoId?: string; color?: HlColor; note?: boolean; find?: boolean; b?: boolean; i?: boolean; ref?: string }

/** Splits one text slice into render segments. Mark offsets are raw-paragraph offsets; `off` is the slice start. */
export function segmentize(text: string, off: number, marks: Mark[]): Seg[] {
  if (!marks.length) return [{ text }];
  const len = text.length;
  const ms = marks.map((m) => ({ ...m, start: Math.max(0, Math.min(len, m.start - off)), end: Math.max(0, Math.min(len, m.end - off)) })).filter((m) => m.end > m.start);
  if (!ms.length) return [{ text }];
  const cuts = Array.from(new Set([0, len, ...ms.flatMap((m) => [m.start, m.end])])).sort((a, b) => a - b);
  const out: Seg[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    const active = ms.filter((m) => m.start <= a && m.end >= b);
    const hl = active.filter((m) => m.annoId).sort((x, y) => y.order - x.order)[0];
    out.push({ text: text.slice(a, b), annoId: hl?.annoId, color: hl?.color, note: hl?.note, find: active.some((m) => m.find) || undefined,
      b: active.some((m) => m.k === 'b') || undefined, i: active.some((m) => m.k === 'i') || undefined, ref: active.find((m) => m.ref)?.ref });
  }
  return out;
}

export function buildFindRegex(q: string): RegExp | null {
  const toks = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
  if (!toks.length) return null;
  const esc = toks.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${esc.join('|')})[\\p{L}\\p{N}]*`, 'giu');
}
export function findMarks(text: string, off: number, re: RegExp | null): Mark[] {
  if (!re) return [];
  const out: Mark[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ start: m.index + off, end: m.index + m[0].length + off, order: -1, find: true });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

/* ── cross references: "Fig. 3.4", "Figures 3.4 and 3.5", "Table 3.2", "Chapter 5", "Chapters 3 and 4" ── */
const LEAD = /\b(Figs?\.|Figures?|Tables?|Chapters?)\s*/g;
const NUM = { fig: /(\d{1,2}\.\d{1,2})(?:[A-H](?![a-z]))?/y, tbl: /(\d{1,2}\.\d{1,2})/y, ch: /(\d{1,2})(?![\d.]\d)/y };
const MORE = /\s*(?:,|and|&|or|to)\s*/y;
export function refMarks(text: string, off: number): Mark[] {
  const out: Mark[] = [];
  LEAD.lastIndex = 0;
  for (let m = LEAD.exec(text); m; m = LEAD.exec(text)) {
    const kind = m[1].startsWith('Fig') ? 'fig' : m[1].startsWith('Tab') ? 'tbl' : 'ch';
    let pos = m.index; // first link spans the keyword + number
    let first = true;
    for (;;) {
      const re = NUM[kind]; re.lastIndex = first ? m.index + m[0].length : pos;
      const n = re.exec(text);
      if (!n) break;
      out.push({ start: (first ? m.index : n.index) + off, end: n.index + n[0].length + off, order: -2, ref: `${kind}:${n[1]}` });
      pos = n.index + n[0].length; first = false;
      MORE.lastIndex = pos; const more = MORE.exec(text);
      if (!more) break;
      pos += more[0].length;
    }
    LEAD.lastIndex = Math.max(LEAD.lastIndex, pos);
  }
  return out;
}
export const emMarks = (em: { s: number; e: number; k: 'b' | 'i' }[] | undefined, off: number): Mark[] =>
  (em ?? []).map((x) => ({ start: x.s + off, end: x.e + off, order: -3, k: x.k }));

/** "fig:3.4" → { chapter: 3, domId: "fig-3.4" } */
export function resolveRef(ref: string): { chapter: number; domId: string | null } {
  const [kind, id] = ref.split(':');
  const chapter = parseInt(id, 10);
  return { chapter, domId: kind === 'ch' ? null : `${kind}-${id}` };
}
