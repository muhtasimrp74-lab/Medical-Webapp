/// <reference lib="webworker" />
import MiniSearch from 'minisearch';
import { openDB } from 'idb';
import { isRunningHeader } from '../lib/parse';

/** Bump when the data or the indexing logic changes: the cached index is rebuilt. */
const VERSION = 'v1';
const OPTIONS = {
  idField: 'id',
  fields: ['text', 'chTitle'],
  storeFields: ['ch', 'chTitle', 'bookPage', 'pdfPage', 'label', 'text'],
};
type Doc = { id: string; ch: string; chTitle: string; bookPage: number | null; pdfPage: number; label: string; text: string };

let base = '';
let ms: MiniSearch<Doc> | null = null;
let ready: Promise<void> | null = null;
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

const idb = () => openDB('medstudy-search', 1, { upgrade: (db) => { db.createObjectStore('idx'); } });
const getJson = async (p: string) => { const r = await fetch(base + 'data/' + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };

async function ensure() {
  const db = await idb();
  const cached = await db.get('idx', 'main');
  if (cached?.version === VERSION) {
    try {
      ms = MiniSearch.loadJSON<Doc>(cached.json, OPTIONS);
      post({ type: 'ready', pages: ms.documentCount, fromCache: true });
      return;
    } catch { /* corrupt cache → rebuild */ }
  }
  const index = await getJson('index.json');
  const files: { id: string; file: string; title: string }[] = [
    { id: 'front', file: index.front_matter_file, title: 'Front matter' },
    ...index.chapters.map((c: { number: number; file: string; title: string }) => ({ id: `ch${String(c.number).padStart(2, '0')}`, file: c.file, title: c.title })),
    { id: 'back', file: index.back_matter_file, title: 'Back matter' },
  ];
  const next = new MiniSearch<Doc>(OPTIONS);
  let done = 0;
  for (const f of files) {
    post({ type: 'progress', done, total: files.length, label: f.title });
    const ch = await getJson(f.file);
    const docs: Doc[] = ch.pages.map((p: { id: string; pdf_page: number; book_page: number | null; paragraphs: string[] }) => ({
      id: p.id, ch: f.id, chTitle: f.title, bookPage: p.book_page ?? null, pdfPage: p.pdf_page,
      label: p.book_page != null ? String(p.book_page) : `pdf ${p.pdf_page}`,
      text: (p.paragraphs ?? []).filter((x) => !isRunningHeader(x)).join(' ').replace(/\s+/g, ' '),
    }));
    next.addAll(docs);
    done++;
  }
  post({ type: 'progress', done, total: files.length, label: 'Saving index' });
  await db.put('idx', { version: VERSION, builtAt: Date.now(), json: JSON.stringify(next) }, 'main');
  ms = next;
  post({ type: 'ready', pages: next.documentCount, fromCache: false });
}

function snippet(text: string, terms: string[]): [string, boolean][] {
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length);
  if (!esc.length) return [[text.slice(0, 220), false]];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${esc.join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const first = re.exec(text);
  const at = first ? first.index : 0;
  let a = Math.max(0, at - 90);
  let b = Math.min(text.length, at + 200);
  if (a > 0) { const sp = text.indexOf(' ', a); if (sp > -1 && sp < at) a = sp + 1; }
  if (b < text.length) { const sp = text.lastIndexOf(' ', b); if (sp > at) b = sp; }
  const slice = text.slice(a, b);
  const out: [string, boolean][] = [];
  if (a > 0) out.push(['… ', false]);
  let last = 0;
  re.lastIndex = 0;
  for (let m = re.exec(slice); m; m = re.exec(slice)) {
    if (m.index > last) out.push([slice.slice(last, m.index), false]);
    out.push([m[0], true]);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < slice.length) out.push([slice.slice(last), false]);
  if (b < text.length) out.push([' …', false]);
  return out;
}

function run(q: string, limit: number) {
  if (!ms) return { total: 0, hits: [], loose: false };
  const base = { prefix: true, fuzzy: (t: string) => (t.length > 5 ? 0.15 : false), boost: { chTitle: 1.5 } } as const;
  let res = ms.search(q, { ...base, combineWith: 'AND' });
  let loose = false;
  if (!res.length && q.trim().split(/\s+/).length > 1) { res = ms.search(q, { ...base, combineWith: 'OR' }); loose = true; }
  const hits = res.slice(0, limit).map((r) => {
    const terms = Array.from(new Set([...(r.queryTerms ?? []), ...(r.terms ?? [])]));
    return {
      id: r.id as string, ch: r.ch as string, chTitle: r.chTitle as string, bookPage: r.bookPage as number | null,
      pdfPage: r.pdfPage as number, label: r.label as string, score: r.score, segs: snippet(r.text as string, terms),
    };
  });
  return { total: res.length, hits, loose };
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'init') base = m.base;
  else if (m.type === 'ensure') {
    ready ??= ensure().catch((err) => { ready = null; post({ type: 'error', message: String(err?.message ?? err) }); });
  } else if (m.type === 'query') {
    (ready ?? Promise.resolve()).then(() => post({ type: 'results', id: m.id, ...run(m.q, m.limit ?? 60) }));
  }
};
