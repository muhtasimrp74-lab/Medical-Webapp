import { useRef, useState } from 'react';
import { downloadJson, exportAll, importBackup } from '../lib/backup';
import { Icon } from './Icon';

export function DataPanel() {
  const file = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const doExport = async () => {
    const b = await exportAll();
    downloadJson(b, `medstudy-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg({ ok: true, text: `Exported ${b.data.annotations?.length ?? 0} highlights/notes and ${b.data.bookmarks?.length ?? 0} bookmarks.` });
  };
  const doImport = async (f: File) => {
    if (mode === 'replace' && !confirm('Replace all existing highlights, notes, bookmarks and progress on this device?')) return;
    try {
      const c = await importBackup(f, mode);
      setMsg({ ok: true, text: `Imported: ${Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ')}. Reloading to apply settings…` });
      setTimeout(() => location.reload(), 1200);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  return (
    <section className="panel" id="data" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <p className="muted">Highlights, notes, bookmarks and progress are stored only in this browser (IndexedDB). Export a JSON backup to move them between devices.</p>
      <div className="row wrap">
        <button className="btn" onClick={doExport}><Icon name="download" size={16} /> Export JSON</button>
        <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={16} /> Import JSON</button>
        <label className="check"><span>On import:</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}><option value="merge">merge (keep newest)</option><option value="replace">replace everything</option></select>
        </label>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
      </div>
      {msg && <p role="status" className={msg.ok ? '' : 'err'}>{msg.text}</p>}
    </section>
  );
}
