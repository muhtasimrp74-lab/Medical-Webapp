import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Annotation, Bookmark, ParsedChapter } from '../lib/types';
import { Icon } from './Icon';

export type SideTab = 'outline' | 'marks';
interface Props {
  chapter: ParsedChapter; annos: Annotation[]; bookmarks: Bookmark[]; curHead: string | null; curIdx: number;
  open: boolean; tab: SideTab; setTab: (t: SideTab) => void; onClose: () => void;
  jumpBlock: (key: string) => void; jumpPage: (pageId: string) => void; jumpAnno: (id: string) => void;
  gotoRef: RefObject<HTMLInputElement | null>;
}

export function Sidebar({ chapter, annos, bookmarks, curHead, curIdx, open, tab, setTab, onClose, jumpBlock, jumpPage, jumpAnno, gotoRef }: Props) {
  const [val, setVal] = useState('');
  const activeRef = useRef<HTMLButtonElement>(null);
  const pages = chapter.pages;
  const first = pages[0], last = pages[pages.length - 1];
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [curHead]);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(val);
    const p = pages.find((x) => x.bookPage === n) ?? pages.find((x) => x.pdfPage === n && x.bookPage == null);
    if (p) { jumpPage(p.id); setVal(''); onClose(); } else gotoRef.current?.setCustomValidity('Not in this chapter');
    gotoRef.current?.reportValidity();
  };
  const range = first.bookPage != null && last.bookPage != null ? `${first.bookPage}–${last.bookPage}` : `${pages.length} pages`;
  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <aside className={`r-side${open ? ' open' : ''}`} aria-label="Chapter navigation">
        <form className="goto" onSubmit={go}>
          <label htmlFor="goto">Go to page <span className="muted">({range})</span></label>
          <div className="row">
            <input id="goto" ref={gotoRef} type="number" inputMode="numeric" value={val} onChange={(e) => { e.target.setCustomValidity(''); setVal(e.target.value); }} placeholder="e.g. 70" />
            <button className="btn" type="submit">Go</button>
          </div>
          <input className="scrub" type="range" min={0} max={pages.length - 1} value={curIdx} aria-label="Scrub through pages" onChange={(e) => jumpPage(pages[+e.target.value].id)} />
        </form>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>Outline</button>
          <button role="tab" aria-selected={tab === 'marks'} onClick={() => setTab('marks')}>Marks <span className="count">{annos.length + bookmarks.length}</span></button>
        </div>
        <div className="side-scroll" role="tabpanel">
          {tab === 'outline' ? (
            chapter.outline.length ? (
              <ul className="outline">
                {chapter.outline.map((o) => (
                  <li key={o.key} className={`lvl${o.level}`}>
                    <button ref={curHead === o.key ? activeRef : undefined} aria-current={curHead === o.key ? 'location' : undefined} onClick={() => { jumpBlock(o.key); onClose(); }}>
                      <span>{o.text}</span><span className="pg">{o.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="muted pad">No headings detected in this part of the book.</p>
          ) : (
            <div className="marks">
              <h3>Bookmarks</h3>
              {bookmarks.length ? <ul>{bookmarks.map((b) => (
                <li key={b.id}><button onClick={() => { jumpPage(b.pageId); onClose(); }}><Icon name="bookmarkFill" size={14} /> Page {b.bookPage ?? `pdf ${b.pdfPage}`}</button></li>
              ))}</ul> : <p className="muted">None yet. Press B to bookmark the current page.</p>}
              <h3>Highlights and notes</h3>
              {annos.length ? <ul>{annos.map((a) => (
                <li key={a.id}><button onClick={() => { jumpAnno(a.id); onClose(); }}>
                  <span className={`dot hl-${a.color}`} aria-hidden="true" />
                  <span className="mq">{a.quote.slice(0, 110)}{a.quote.length > 110 ? '…' : ''}{a.note && <em> — {a.note.slice(0, 80)}</em>}</span>
                  <span className="pg">{a.bookPage ?? `pdf ${a.pdfPage}`}</span>
                </button></li>
              ))}</ul> : <p className="muted">Select any text to highlight it or add a note.</p>}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
