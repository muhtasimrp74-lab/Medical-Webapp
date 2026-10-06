import type { HlColor } from './types';

export interface Mark { start: number; end: number; order: number; annoId?: string; color?: HlColor; note?: boolean; find?: boolean }
export interface Seg { text: string; annoId?: string; color?: HlColor; note?: boolean; find?: boolean }

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
    out.push({ text: text.slice(a, b), annoId: hl?.annoId, color: hl?.color, note: hl?.note, find: active.some((m) => m.find) || undefined });
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
