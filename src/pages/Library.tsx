import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCatalog } from '../lib/data';
import { allProgress, listBookmarks, useLive } from '../lib/db';
import { UNITS } from '../lib/units';
import type { Bookmark, CatalogEntry, Progress } from '../lib/types';
import { DataPanel } from '../components/DataPanel';
import { Icon } from '../components/Icon';
import { openSearch } from '../components/SearchDialog';

const pct = (p?: Progress) => (p && p.total ? Math.min(100, Math.round((p.readPages.length / p.total) * 100)) : 0);
const pageText = (p: { bookPage: number | null; pageIdx?: number }) => (p.bookPage != null ? `p. ${p.bookPage}` : 'start');
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export default function Library() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const progress = useLive(['progress'], allProgress, [], [] as Progress[]);
  const bookmarks = useLive(['bookmarks'], () => listBookmarks(), [], [] as Bookmark[]);
  useEffect(() => { document.title = 'Library · MedStudy'; loadCatalog().then(setCatalog).catch((e) => setErr(e.message)); }, []);

  const byId = useMemo(() => new Map(progress.map((p) => [p.chapterId, p])), [progress]);
  const entry = (id: string) => catalog?.find((c) => c.id === id);
  const recent = useMemo(() => [...progress].filter((p) => p.pageId).sort((a, b) => b.updated - a.updated), [progress]);
  const cont = recent[0];
  const contEntry = cont && entry(cont.chapterId);
  const totalRead = progress.reduce((n, p) => n + p.readPages.length, 0);
  const totalPages = catalog?.reduce((n, c) => n + c.pageCount, 0) ?? 0;

  if (err) return <main className="wrap"><p className="err">Couldn’t load the book index: {err}</p></main>;
  if (!catalog) return <main className="wrap" aria-busy="true"><p className="muted">Loading library…</p></main>;

  const row = (c: CatalogEntry) => {
    const p = byId.get(c.id); const v = pct(p);
    return (
      <li key={c.id}>
        <Link to={`/read/${c.id}`} className="ch-row">
          <span className="ch-no" aria-hidden="true">{c.number ?? '–'}</span>
          <span className="ch-main">
            <span className="ch-title">{c.title}</span>
            <span className="muted ch-sub">{c.bookPages ? `pp. ${c.bookPages[0]}–${c.bookPages[1]} · ` : ''}{c.pageCount} pages{p?.updated ? ` · last read ${ago(p.updated)}` : ''}</span>
          </span>
          <span className="ch-prog" role="img" aria-label={`${v}% read`}>
            <span className="bar"><span style={{ width: `${v}%` }} /></span><span className="pc">{v}%</span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <main className="wrap lib">
      <section className="lib-hero">
        <div>
          <h1>Robbins Pathologic Basis of Disease</h1>
          <p className="muted">{catalog.filter((c) => c.number).length} chapters · {totalPages.toLocaleString()} pages{totalRead ? ` · ${totalRead} pages read` : ''}</p>
        </div>
        <div className="row wrap">
          {contEntry && cont ? (
            <Link className="btn primary big" to={`/read/${cont.chapterId}`}>
              <Icon name="book" /> Continue: {contEntry.number ? `Ch ${contEntry.number}` : contEntry.title}, {pageText(cont)}
            </Link>
          ) : (
            <Link className="btn primary big" to={`/read/${catalog.find((c) => c.number === 1)?.id ?? 'ch01'}`}><Icon name="book" /> Start reading</Link>
          )}
          <button className="btn big" onClick={openSearch}><Icon name="search" /> Search <kbd>Ctrl K</kbd></button>
        </div>
      </section>

      {(recent.length > 0 || bookmarks.length > 0) && (
        <div className="lib-cols">
          {recent.length > 0 && (
            <section aria-labelledby="rec-h"><h2 id="rec-h">Recently read</h2>
              <ul className="plain">{recent.slice(0, 5).map((p) => {
                const c = entry(p.chapterId); if (!c) return null;
                return <li key={p.chapterId}><Link to={`/read/${p.chapterId}`}><b>{c.number ? `Ch ${c.number}` : c.title}</b> {c.number ? c.title : ''} <span className="muted">· {pageText(p)} · {ago(p.updated)}</span></Link></li>;
              })}</ul>
            </section>
          )}
          {bookmarks.length > 0 && (
            <section aria-labelledby="bm-h"><h2 id="bm-h">Bookmarks</h2>
              <ul className="plain">{bookmarks.slice(0, 8).map((b) => {
                const c = entry(b.chapterId);
                return <li key={b.id}><Link to={`/read/${b.chapterId}?pg=${encodeURIComponent(b.pageId)}`}><Icon name="bookmarkFill" size={14} /> {c?.number ? `Ch ${c.number}` : c?.title} <span className="muted">· {c?.number ? c.title + ' · ' : ''}p. {b.bookPage ?? `pdf ${b.pdfPage}`}</span></Link></li>;
              })}</ul>
            </section>
          )}
        </div>
      )}

      {UNITS.map((u) => {
        const chs = catalog.filter((c) => c.number && c.number >= u.chapters[0] && c.number <= u.chapters[1]);
        const read = chs.reduce((n, c) => n + (byId.get(c.id)?.readPages.length ?? 0), 0);
        const tot = chs.reduce((n, c) => n + c.pageCount, 0);
        return (
          <section className="unit" key={u.title} aria-labelledby={`u-${u.chapters[0]}`}>
            <div className="unit-head">
              <h2 id={`u-${u.chapters[0]}`}>{u.title}</h2>
              <p className="muted">{u.blurb} · {Math.round((read / tot) * 100)}% read</p>
            </div>
            <ul className="ch-list">{chs.map(row)}</ul>
          </section>
        );
      })}
      <section className="unit" aria-labelledby="u-fb">
        <div className="unit-head"><h2 id="u-fb">Front and back matter</h2></div>
        <ul className="ch-list">{catalog.filter((c) => !c.number).map(row)}</ul>
      </section>
      <DataPanel />
    </main>
  );
}
