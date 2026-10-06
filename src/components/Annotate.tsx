import { useEffect, useRef, useState, type RefObject } from 'react';
import { HL_COLORS, type Annotation, type HlColor } from '../lib/types';
import { Icon } from './Icon';

const NAMES: Record<HlColor, string> = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' };

export function Swatches({ value, onPick, label = 'Highlight colour' }: { value?: HlColor; onPick: (c: HlColor) => void; label?: string }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {HL_COLORS.map((c, i) => (
        <button key={c} className={`swatch hl-${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)} aria-pressed={value === c} aria-label={`${NAMES[c]} (Alt+${i + 1})`} title={`${NAMES[c]} · Alt+${i + 1}`}>
          {value === c && <Icon name="check" size={14} />}
        </button>
      ))}
    </div>
  );
}

/** Floating toolbar shown when text inside the reader column is selected. */
export function SelectionBar({ col, lastColor, onHighlight, onNote }: { col: RefObject<HTMLElement | null>; lastColor: HlColor; onHighlight: (c: HlColor) => void; onNote: () => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    let t = 0;
    const check = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount || !col.current) return setRect(null);
      const r = s.getRangeAt(0);
      if (!col.current.contains(r.commonAncestorContainer)) return setRect(null);
      setRect(r.getBoundingClientRect());
    };
    const on = () => { window.clearTimeout(t); t = window.setTimeout(check, 90); };
    document.addEventListener('selectionchange', on);
    window.addEventListener('scroll', on, { passive: true });
    return () => { document.removeEventListener('selectionchange', on); window.removeEventListener('scroll', on); window.clearTimeout(t); };
  }, [col]);
  if (!rect) return null;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const style = coarse
    ? { left: '50%', bottom: 'calc(env(safe-area-inset-bottom) + 16px)', transform: 'translateX(-50%)' }
    : { left: Math.max(8, Math.min(window.innerWidth - 260, rect.left + rect.width / 2 - 125)), top: rect.top > 70 ? rect.top - 52 : rect.bottom + 10 };
  return (
    <div className="sel-bar" role="toolbar" aria-label="Highlight selection" style={style} onMouseDown={(e) => e.preventDefault()}>
      <Swatches value={lastColor} onPick={onHighlight} />
      <button className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={onNote} title="Add margin note · Alt+N"><Icon name="note" size={16} /> Note</button>
    </div>
  );
}

export interface EditorState { anno: Annotation; isNew: boolean; rect: DOMRect | null; opener: HTMLElement | null }

export function AnnoEditor({ state, onSave, onDelete, onClose }: { state: EditorState; onSave: (a: Annotation) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [color, setColor] = useState<HlColor>(state.anno.color);
  const [note, setNote] = useState(state.anno.note);
  const ref = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { area.current?.focus(); }, []);
  const save = () => onSave({ ...state.anno, color, note: note.trim() });
  const r = state.rect;
  const style = r && window.innerWidth >= 700
    ? { left: Math.max(8, Math.min(window.innerWidth - 348, r.left)), top: Math.max(8, Math.min(window.innerHeight - 330, r.bottom + 10)) }
    : undefined;
  return (
    <div className="editor" role="dialog" aria-label={state.isNew ? 'New note' : 'Edit highlight'} style={style} ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
      }}>
      <blockquote className={`quote hl-${color}`}>{state.anno.quote.length > 160 ? state.anno.quote.slice(0, 160) + '…' : state.anno.quote}</blockquote>
      <Swatches value={color} onPick={setColor} />
      <label className="field">
        <span>Margin note</span>
        <textarea ref={area} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a note…" />
      </label>
      <div className="row">
        {!state.isNew && <button className="btn danger" onClick={() => onDelete(state.anno.id)}><Icon name="trash" size={16} /> Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}
