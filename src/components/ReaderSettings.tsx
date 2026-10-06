import { useEffect, useRef } from 'react';
import { useSettings } from '../lib/settings';
import type { ThemeName } from '../lib/types';

const THEMES: { id: ThemeName; label: string }[] = [{ id: 'paper', label: 'Paper' }, { id: 'sepia', label: 'Sepia' }, { id: 'dark', label: 'Dark' }];

export function ReaderSettings({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input,button')?.focus();
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-settings-toggle]')) onClose();
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [onClose]);
  return (
    <div className="popover settings-pop" role="dialog" aria-label="Reading comfort" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="field">
        <span id="th">Theme</span>
        <div className="seg" role="radiogroup" aria-labelledby="th">
          {THEMES.map((t) => (
            <button key={t.id} role="radio" aria-checked={settings.theme === t.id} className={`seg-btn theme-${t.id}`} onClick={() => update({ theme: t.id })}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span id="ff">Typeface</span>
        <div className="seg" role="radiogroup" aria-labelledby="ff">
          <button role="radio" aria-checked={settings.family === 'serif'} className="seg-btn serif" onClick={() => update({ family: 'serif' })}>Serif</button>
          <button role="radio" aria-checked={settings.family === 'sans'} className="seg-btn" onClick={() => update({ family: 'sans' })}>Sans</button>
        </div>
      </div>
      <label className="field range"><span>Font size <b>{settings.fontSize}px</b></span>
        <input type="range" min={14} max={28} step={1} value={settings.fontSize} onChange={(e) => update({ fontSize: +e.target.value })} /></label>
      <label className="field range"><span>Line height <b>{settings.lineHeight.toFixed(2)}</b></span>
        <input type="range" min={1.3} max={2.1} step={0.05} value={settings.lineHeight} onChange={(e) => update({ lineHeight: +e.target.value })} /></label>
      <label className="field range"><span>Line width <b>{settings.measure} ch</b></span>
        <input type="range" min={40} max={96} step={2} value={settings.measure} onChange={(e) => update({ measure: +e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={settings.focus} onChange={(e) => update({ focus: e.target.checked })} /> Focus mode <span className="muted">(F)</span></label>
      <details className="keys">
        <summary>Keyboard shortcuts</summary>
        <dl>
          <dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous / next page</dd>
          <dt><kbd>G</kbd></dt><dd>Go to page</dd>
          <dt><kbd>O</kbd></dt><dd>Outline</dd>
          <dt><kbd>B</kbd></dt><dd>Bookmark page</dd>
          <dt><kbd>F</kbd></dt><dd>Focus mode</dd>
          <dt><kbd>T</kbd></dt><dd>Cycle theme</dd>
          <dt><kbd>Alt</kbd>+<kbd>1–4</kbd></dt><dd>Highlight selection</dd>
          <dt><kbd>Alt</kbd>+<kbd>N</kbd></dt><dd>Note on selection</dd>
          <dt><kbd>Ctrl/⌘</kbd>+<kbd>K</kbd></dt><dd>Search</dd>
        </dl>
      </details>
    </div>
  );
}
