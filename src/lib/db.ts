import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { useEffect, useRef, useState } from 'react';
import type { Annotation, Attempt, Bookmark, ChapterId, Progress, Question, ReviewCard, StudyNote } from './types';

interface Schema extends DBSchema {
  annotations: { key: string; value: Annotation; indexes: { 'by-chapter': string } };
  bookmarks: { key: string; value: Bookmark; indexes: { 'by-chapter': string } };
  progress: { key: ChapterId; value: Progress };
  /* Phase 2+ stores are created now so no migration is needed later. */
  questions: { key: string; value: Question; indexes: { 'by-exam': string; 'by-type': string } };
  attempts: { key: string; value: Attempt; indexes: { 'by-question': string } };
  reviewCards: { key: string; value: ReviewCard; indexes: { 'by-due': number } };
  studyNotes: { key: string; value: StudyNote };
}
export type StoreName = 'annotations' | 'bookmarks' | 'progress' | 'questions' | 'attempts' | 'reviewCards' | 'studyNotes';
/** Stores included in JSON export/import. */
export const BACKUP_STORES: StoreName[] = ['annotations', 'bookmarks', 'progress', 'questions', 'attempts', 'reviewCards', 'studyNotes'];

let dbP: Promise<IDBPDatabase<Schema>> | null = null;
export const getDb = () =>
  (dbP ??= openDB<Schema>('medstudy', 1, {
    upgrade(db) {
      db.createObjectStore('annotations', { keyPath: 'id' }).createIndex('by-chapter', 'chapterId');
      db.createObjectStore('bookmarks', { keyPath: 'id' }).createIndex('by-chapter', 'chapterId');
      db.createObjectStore('progress', { keyPath: 'chapterId' });
      const q = db.createObjectStore('questions', { keyPath: 'id' });
      q.createIndex('by-exam', 'exam'); q.createIndex('by-type', 'type');
      db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('by-question', 'questionId');
      db.createObjectStore('reviewCards', { keyPath: 'id' }).createIndex('by-due', 'due');
      db.createObjectStore('studyNotes', { keyPath: 'id' });
    },
  }));

/* ── change notifications (same tab via EventTarget, other tabs via BroadcastChannel) ── */
const bus = new EventTarget();
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('medstudy-db') : null;
chan?.addEventListener('message', (e) => bus.dispatchEvent(new Event(String(e.data))));
export const notify = (store: StoreName) => { bus.dispatchEvent(new Event(store)); chan?.postMessage(store); };

export function useLive<T>(topics: StoreName[], load: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => {
    let alive = true;
    const run = () => { loadRef.current().then((v) => alive && setValue(v)).catch(() => {}); };
    run();
    topics.forEach((t) => bus.addEventListener(t, run));
    return () => { alive = false; topics.forEach((t) => bus.removeEventListener(t, run)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/* ── annotations (highlights + margin notes) ── */
export async function listAnnotations(chapterId?: ChapterId): Promise<Annotation[]> {
  const db = await getDb();
  const all = chapterId ? await db.getAllFromIndex('annotations', 'by-chapter', chapterId) : await db.getAll('annotations');
  return all.sort((a, b) => a.created - b.created);
}
export async function putAnnotation(a: Annotation) { await (await getDb()).put('annotations', { ...a, updated: Date.now() }); notify('annotations'); }
export async function deleteAnnotation(id: string) { await (await getDb()).delete('annotations', id); notify('annotations'); }

/* ── bookmarks ── */
export async function listBookmarks(chapterId?: ChapterId): Promise<Bookmark[]> {
  const db = await getDb();
  const all = chapterId ? await db.getAllFromIndex('bookmarks', 'by-chapter', chapterId) : await db.getAll('bookmarks');
  return all.sort((a, b) => b.created - a.created);
}
export async function toggleBookmark(b: Omit<Bookmark, 'id' | 'created'>): Promise<boolean> {
  const db = await getDb();
  const id = `${b.chapterId}:${b.pageId}`;
  const existing = await db.get('bookmarks', id);
  if (existing) await db.delete('bookmarks', id); else await db.put('bookmarks', { ...b, id, created: Date.now() });
  notify('bookmarks');
  return !existing;
}

/* ── reading progress ── */
export async function allProgress(): Promise<Progress[]> { return (await getDb()).getAll('progress'); }
export async function getProgress(id: ChapterId) { return (await getDb()).get('progress', id); }
export async function updateProgress(id: ChapterId, total: number, mutate: (p: Progress) => void) {
  const db = await getDb();
  const tx = db.transaction('progress', 'readwrite');
  const p = (await tx.store.get(id)) ?? { chapterId: id, readPages: [], total, pageId: '', pageIdx: 0, bookPage: null, frac: 0, updated: 0 };
  p.total = total;
  mutate(p);
  p.updated = Date.now();
  await tx.store.put(p);
  await tx.done;
  notify('progress');
}

export async function requestPersistence() {
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}
