import type { BookIndex, CatalogEntry, ParsedChapter, RawChapter } from './types';
import { buildCatalog } from './units';
import { parseChapter } from './parse';

/** Absolute URL of the app root (works for any base path and from inside workers when passed along). */
export const appBase = () => new URL(import.meta.env.BASE_URL, document.baseURI).href;
export const dataUrl = (path: string) => `${appBase()}data/${path}`;
export const pageImageUrl = (pdfPage: number) => `${appBase()}pages/${pdfPage}.webp`;

async function getJson<T>(path: string): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(dataUrl(path), { signal: ctl.signal });
    if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`Timed out loading ${path}`);
    throw e;
  } finally { clearTimeout(timer); }
}

/** Escape hatch: unregister the service worker and clear its caches, then reload. */
export async function resetOfflineCache() {
  try { (await navigator.serviceWorker?.getRegistrations())?.forEach((r) => r.unregister()); } catch { /* ignore */ }
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* ignore */ }
  location.reload();
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
