import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { getSearchState, search, startSearch, subscribeSearch, type SearchResult, type SearchState } from '../lib/searchClient';

const EVT = 'medstudy:open-search';
export const openSearch = () => window.dispatchEvent(new Event(EVT));

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResult | null>(null);
  const [active, setActive] = useState(0);
  const [st, setSt] = useState<SearchState>(getSearchState());
  const nav = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const show = () => { setOpen(true); startSearch(); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); show(); } };
    window.addEventListener(EVT, show); window.addEventListener('keydown', key);
    const un = subscribeSearch(setSt);
    return () => { window.removeEventListener(EVT, show); window.removeEventListener('keydown', key); un(); };
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setRes(null); return; }
    let live = true;
    const t = setTimeout(() => search(q.trim()).then((r) => { if (live) { setRes(r); setActive(0); } }), 140);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, st.status]);

  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const go = (i: number) => {
    const h = res?.hits[i]; if (!h) return;
    setOpen(false);
    nav(`/read/${h.ch}?pg=${encodeURIComponent(h.id)}&q=${encodeURIComponent(q.trim())}`);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!res?.hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(res.hits.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(active); }
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} label="Search the book" className="dlg-search">
      <div className="search-head">
        <Icon name="search" />
        <input autoFocus type="search" role="combobox" aria-expanded={!!res?.hits.length} aria-controls="sr-list" aria-activedescendant={res?.hits.length ? `sr-${active}` : undefined}
          placeholder="Search the whole book…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} aria-label="Search" />
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close search"><Icon name="close" /></button>
      </div>
      {st.status === 'building' && (
        <p className="muted pad" role="status">Building the search index (first run only, then cached offline)… {st.done}/{st.total} {st.label && `· ${st.label}`}</p>
      )}
      {st.status === 'error' && <p className="pad err" role="alert">Search index failed: {st.message}. <button className="btn small" onClick={() => startSearch()}>Retry</button></p>}
      <div className="sr-status muted" role="status" aria-live="polite">
        {res ? (res.total ? `${res.total} page${res.total === 1 ? '' : 's'}${res.loose ? ' (matching any word)' : ''}${res.total > res.hits.length ? `, showing top ${res.hits.length}` : ''}` : 'No matches') : q.trim().length < 2 ? 'Type at least two letters.' : ''}
      </div>
      <ul id="sr-list" className="sr-list" role="listbox" ref={listRef} aria-label="Results">
        {res?.hits.map((h, i) => (
          <li key={h.id} id={`sr-${i}`} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => go(i)}>
            <div className="sr-meta"><strong>{h.ch.startsWith('ch') ? `Ch ${Number(h.ch.slice(2))}` : h.chTitle}</strong> <span>{h.ch.startsWith('ch') ? h.chTitle : ''}</span><span className="pg">p. {h.label}</span></div>
            <p>{h.segs.map(([t, m], j) => (m ? <mark key={j}>{t}</mark> : t))}</p>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
