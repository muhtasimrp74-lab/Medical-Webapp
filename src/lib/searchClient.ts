import { appBase } from './data';

export interface SearchHit {
  id: string; ch: string; chTitle: string; bookPage: number | null; pdfPage: number; label: string; score: number; segs: [string, boolean][];
}
export interface SearchResult { total: number; hits: SearchHit[]; loose: boolean }
export interface SearchState { status: 'idle' | 'building' | 'ready' | 'error'; done: number; total: number; label: string; fromCache?: boolean; message?: string }

let worker: Worker | null = null;
let state: SearchState = { status: 'idle', done: 0, total: 30, label: '' };
const subs = new Set<(s: SearchState) => void>();
const pending = new Map<number, (r: SearchResult) => void>();
let seq = 0;
const set = (s: Partial<SearchState>) => { state = { ...state, ...s }; subs.forEach((f) => f(state)); };

export const getSearchState = () => state;
export function subscribeSearch(fn: (s: SearchState) => void) { subs.add(fn); return () => { subs.delete(fn); }; }

/** Starts the worker (once). First run builds the index from the JSON and caches it in IndexedDB. */
export function startSearch() {
  if (worker) return;
  worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'progress') set({ status: 'building', done: m.done, total: m.total, label: m.label });
    else if (m.type === 'ready') set({ status: 'ready', fromCache: m.fromCache });
    else if (m.type === 'error') { set({ status: 'error', message: m.message }); worker?.terminate(); worker = null; }
    else if (m.type === 'results') { pending.get(m.id)?.(m); pending.delete(m.id); }
  };
  worker.postMessage({ type: 'init', base: appBase() });
  set({ status: 'building', done: 0, label: 'Starting' });
  worker.postMessage({ type: 'ensure' });
}

export function search(q: string): Promise<SearchResult> {
  startSearch();
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    worker?.postMessage({ type: 'query', id, q, limit: 60 });
  });
}
