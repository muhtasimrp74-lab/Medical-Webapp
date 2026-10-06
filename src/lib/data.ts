import type { BookIndex, CatalogEntry, ParsedChapter, RawChapter } from './types';
import { buildCatalog } from './units';
import { parseChapter } from './parse';

/** Absolute URL of the app root (works for any base path and from inside workers when passed along). */
export const appBase = () => new URL(import.meta.env.BASE_URL, document.baseURI).href;
export const dataUrl = (path: string) => `${appBase()}data/${path}`;
export const pageImageUrl = (pdfPage: number) => `${appBase()}pages/${pdfPage}.webp`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(dataUrl(path));
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

let catalogP: Promise<CatalogEntry[]> | null = null;
export function loadCatalog(): Promise<CatalogEntry[]> {
  catalogP ??= getJson<BookIndex>('index.json').then(buildCatalog).catch((e) => { catalogP = null; throw e; });
  return catalogP;
}

/** One file per route; only the 3 most recent chapters stay in memory. */
const cache = new Map<string, Promise<ParsedChapter>>();
export function loadChapter(entry: CatalogEntry): Promise<ParsedChapter> {
  const hit = cache.get(entry.id);
  if (hit) { cache.delete(entry.id); cache.set(entry.id, hit); return hit; }
  const p = getJson<RawChapter>(entry.file)
    .then((raw) => parseChapter(raw, entry.id, entry.title))
    .catch((e) => { cache.delete(entry.id); throw e; });
  cache.set(entry.id, p);
  while (cache.size > 3) cache.delete(cache.keys().next().value as string);
  return p;
}
