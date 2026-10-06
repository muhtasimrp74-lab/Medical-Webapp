import { BACKUP_STORES, getDb, notify, type StoreName } from './db';
import { DEFAULT_SETTINGS } from './types';

const SETTINGS_KEY = 'medstudy.settings';
export interface BackupFile { app: 'medstudy'; schema: 1; exportedAt: string; settings?: unknown; data: Partial<Record<StoreName, unknown[]>> }

export async function exportAll(): Promise<BackupFile> {
  const db = await getDb();
  const data: BackupFile['data'] = {};
  for (const s of BACKUP_STORES) data[s] = await db.getAll(s);
  let settings: unknown;
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') ?? undefined; } catch { /* ignore */ }
  return { app: 'medstudy', schema: 1, exportedAt: new Date().toISOString(), settings, data };
}

export function downloadJson(obj: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const stamp = (r: unknown) => ((r as { updated?: number; created?: number }).updated ?? (r as { created?: number }).created ?? 0);

/** merge: keep the newer record per id. replace: wipe each store first. Returns counts per store. */
export async function importBackup(file: File, mode: 'merge' | 'replace'): Promise<Record<string, number>> {
  let parsed: BackupFile;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('That file is not valid JSON.'); }
  if (parsed?.app !== 'medstudy' || typeof parsed.data !== 'object') throw new Error('This does not look like a MedStudy backup.');
  const db = await getDb();
  const counts: Record<string, number> = {};
  for (const s of BACKUP_STORES) {
    const rows = parsed.data[s];
    if (!Array.isArray(rows)) continue;
    const tx = db.transaction(s, 'readwrite');
    if (mode === 'replace') await tx.store.clear();
    let n = 0;
    for (const row of rows as Record<string, unknown>[]) {
      const key = (row.id ?? row.chapterId) as string | undefined;
      if (!key) continue;
      const cur = mode === 'merge' ? await tx.store.get(key as never) : undefined;
      if (!cur || stamp(row) >= stamp(cur)) { await tx.store.put(row as never); n++; }
    }
    await tx.done;
    counts[s] = n;
    notify(s);
  }
  if (parsed.settings && typeof parsed.settings === 'object') {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...(parsed.settings as object) })); } catch { /* ignore */ }
  }
  return counts;
}
