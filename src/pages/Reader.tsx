import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadCatalog, loadChapter, resetOfflineCache } from '../lib/data';
import { getProgress, listAnnotations, listBookmarks, putAnnotation, deleteAnnotation, toggleBookmark, uid, updateProgress, useLive, requestPersistence } from '../lib/db';
import { useSettings } from '../lib/settings';
import { buildFindRegex, resolveRef } from '../lib/segments';
import { chapterIdFromNumber } from '../lib/units';
import { selectionToSegments } from '../lib/anchors';
import type { Annotation, CatalogEntry, HlColor, ParsedChapter } from '../lib/types';
import { HL_COLORS, type ThemeName } from '../lib/types';
import { BlockRow, ReaderCtx, anchorsOf, blockParts } from '../components/Blocks';
import { Sidebar, type SideTab } from '../components/Sidebar';
import { AnnoEditor, SelectionBar, type EditorState } from '../components/Annotate';
import { ReaderSettings } from '../components/ReaderSettings';
import { PageImageDialog } from '../components/PageImageDialog';
import { Icon } from '../components/Icon';
import { openSearch } from '../components/SearchDialog';

const BAR_H = 52;
const THEME_ORDER: ThemeName[] = ['paper', 'sepia', 'dark'];

export default function Reader() {
  const { chapterId = '' } = useParams();
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [chapter, setChapter] = useState<ParsedChapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, [chapterId, attempt]);
  useEffect(() => { loadCatalog().then(setCatalog).catch((e) => setError(e.message)); }, [attempt]);
  const idx = catalog ? catalog.findIndex((e) => e.id === chapterId) : -1;
  const entry = catalog?.[idx];
  useEffect(() => {
    setChapter(null);
    if (!entry) return;
    setError(null);
    loadChapter(entry).then(setChapter).catch((e) => setError(e.message));
  }, [entry, attempt]);
  useEffect(() => { if (entry) document.title = `${entry.title} · MedStudy`; return () => { document.title = 'MedStudy'; }; }, [entry]);

  if (error) return (<main className="center-msg"><h1>Couldn’t load this chapter</h1><p className="muted">{error}. You may be offline and haven’t read this chapter yet.</p><button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button> <Link className="btn" to="/">Library</Link></main>);
  if (catalog && !entry) return (<main className="center-msg"><h1>Chapter not found</h1><Link className="btn primary" to="/">Back to library</Link></main>);
  if (!entry || !chapter) return (
    <main className="center-msg" aria-busy="true">
      <p className="muted">Loading chapter…</p>
      {slow && (<>
        <p className="muted">This is taking longer than expected. Check your connection, or clear the offline cache and retry.</p>
        <button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>Retry</button> <button className="btn" onClick={resetOfflineCache}>Reset offline cache</button>
      </>)}
    </main>);
  return <ReaderView key={entry.id} entry={entry} chapter={chapter} prev={catalog![idx - 1]} next={catalog![idx + 1]} />;
}

function ReaderView({ entry, chapter, prev, next }: { entry: CatalogEntry; chapter: ParsedChapter; prev?: CatalogEntry; next?: CatalogEntry }) {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { settings, update } = useSettings();
  const annos = useLive(['annotations'], () => listAnnotations(entry.id), [entry.id], [] as Annotation[]);
  const bookmarks = useLive(['bookmarks'], () => listBookmarks(entry.id), [entry.id], []);
  const [curIdx, setCurIdx] = useState(0);
  const [curHead, setCurHead] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [tab, setTab] = useState<SideTab>('outline');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [img, setImg] = useState<{ pdfPage: number; label: string } | null>(null);
  const [setOpen, setSetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
  const col = useRef<HTMLDivElement>(null);
  const gotoRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);
  const q = sp.get('q') ?? '';
  const findRe = useMemo(() => buildFindRegex(q), [q]);
  const pages = chapter.pages;
  const bmSet = useMemo(() => new Set(bookmarks.map((b) => b.pageId)), [bookmarks]);
  const pageMap = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const pageIdx = useMemo(() => new Map(pages.map((p, i) => [p.id, i])), [pages]);
  const annosByPart = useMemo(() => {
    const m = new Map<string, Annotation[]>();
    annos.forEach((a) => a.segments.forEach((s) => { const k = `${s.pageId}:${s.pi}`; const l = m.get(k) ?? []; if (!l.includes(a)) l.push(a); m.set(k, l); }));
    return m;
  }, [annos]);

  /* ── jumping ── */
  const scrollEl = (el: HTMLElement | null, block: ScrollLogicalPosition = 'start') => el?.scrollIntoView({ block, behavior: 'auto' });
  const jumpPage = useCallback((id: string) => scrollEl(document.getElementById(`pg-${id}`)), []);
  const jumpBlock = useCallback((key: string) => scrollEl(document.getElementById(`b-${key}`)), []);
  const flash = (el: HTMLElement | null) => { if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
  const goRef = useCallback((ref: string) => {
    const { chapter, domId } = resolveRef(ref);
    if (chapter !== entry.number) { nav(`/read/${chapterIdFromNumber(chapter)}${domId ? `?ref=${domId}` : ''}`); return; }
    const el = domId ? document.getElementById(domId) : null;
    if (el) { el.scrollIntoView({ block: 'center' }); flash(el); }
    else if (!domId) window.scrollTo({ top: 0 });
    else setNotice(`${domId.startsWith('fig') ? 'Figure' : 'Table'} ${domId.slice(4)} has no caption in the extracted text.`);
  }, [entry.number, nav]);
  const jumpAnno = useCallback((id: string) => { const el = document.querySelector<HTMLElement>(`[data-anno="${id}"]`); scrollEl(el, 'center'); el?.focus({ preventScroll: true }); }, []);

  /* ── restore position (URL ?ref= / ?pg= win, else saved progress) ── */
  useLayoutEffect(() => {
    history.scrollRestoration = 'manual';
    const strip = (k: string) => { const n = new URLSearchParams(sp); n.delete(k); setSp(n, { replace: true }); };
    const ref = sp.get('ref'); const pg = sp.get('pg');
    const refEl = ref ? document.getElementById(ref) : null;
    if (ref && !refEl) setNotice(`${ref.startsWith('fig') ? 'Figure' : 'Table'} ${ref.slice(4)} has no caption in the extracted text.`);
    if (refEl) { refEl.scrollIntoView({ block: 'center' }); flash(refEl); restored.current = true; strip('ref'); }
    else if (pg) {
      const a = document.getElementById(`pg-${pg}`);
      const hit = document.querySelector<HTMLElement>('mark.find');
      const near = hit && a && Math.abs(hit.getBoundingClientRect().top - a.getBoundingClientRect().top) < window.innerHeight * 1.5;
      if (near) scrollEl(hit, 'center'); else scrollEl(a);
      restored.current = true; strip('pg');
    } else {
      getProgress(entry.id).then((p) => {
        const a = p?.pageId ? document.getElementById(`pg-${p.pageId}`) : null;
        if (a) {
          const nxt = document.getElementById(`pg-${pages[(p?.pageIdx ?? 0) + 1]?.id}`);
          const h = Math.max(1, (nxt ? nxt.getBoundingClientRect().top : document.documentElement.scrollHeight) - a.getBoundingClientRect().top);
          window.scrollTo({ top: a.getBoundingClientRect().top + window.scrollY - BAR_H - 8 + (p?.frac ?? 0) * h });
        }
        restored.current = true;
      }).catch(() => { restored.current = true; });
    }
    return () => { history.scrollRestoration = 'auto'; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── scroll spy + save position ── */
  useEffect(() => {
    const el = col.current!;
    let pageTops: { i: number; top: number }[] = [], heads: { key: string; top: number }[] = [], raf = 0, timer = 0, ci = -1, ch: string | null = null;
    const measure = () => {
      pageTops = Array.from(el.querySelectorAll<HTMLElement>('.pg-anchor[data-page]'))
        .map((a) => ({ i: pageIdx.get(a.dataset.page!) ?? 0, top: a.getBoundingClientRect().top + window.scrollY }))
        .sort((x, y) => x.top - y.top);
      heads = Array.from(el.querySelectorAll<HTMLElement>('[data-h]')).map((h) => ({ key: h.closest('.blk')!.id.slice(2), top: h.getBoundingClientRect().top + window.scrollY }));
    };
    const pos = () => {
      const y = window.scrollY + BAR_H + 24;
      let k = 0; for (let j = 0; j < pageTops.length && pageTops[j].top <= y; j++) k = j;
      const cur = pageTops[k]; let h: string | null = null;
      for (const x of heads) { if (x.top <= y) h = x.key; else break; }
      const height = Math.max(1, (pageTops[k + 1]?.top ?? document.documentElement.scrollHeight) - (cur?.top ?? 0));
      return { i: cur?.i ?? 0, h, frac: Math.max(0, Math.min(1, (window.scrollY + BAR_H + 8 - (cur?.top ?? 0)) / height)) };
    };
    const save = () => {
      if (!restored.current) return;
      const { i, frac } = pos(); const p = pages[i];
      updateProgress(entry.id, pages.length, (pr) => { pr.pageId = p.id; pr.pageIdx = i; pr.bookPage = p.bookPage; pr.frac = frac; });
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const { i, h } = pos();
        if (i !== ci) { ci = i; setCurIdx(i); }
        if (h !== ch) { ch = h; setCurHead(h); }
        window.clearTimeout(timer); timer = window.setTimeout(save, 600);
      });
    };
    const ro = new ResizeObserver(() => { measure(); onScroll(); });
    ro.observe(el); measure(); onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const flush = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', flush);
    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', flush); ro.disconnect(); window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [entry.id, pages, pageIdx]);

  /* page counts as read after 2.5 s of dwell */
  useEffect(() => {
    const t = window.setTimeout(() => { if (restored.current) updateProgress(entry.id, pages.length, (p) => { if (!p.readPages.includes(curIdx)) p.readPages.push(curIdx); }); }, 2500);
    return () => window.clearTimeout(t);
  }, [curIdx, entry.id, pages.length]);

  /* focus mode: dim everything but the blocks near the middle of the screen */
  useEffect(() => {
    if (!settings.focus) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('in-focus', e.isIntersecting)), { rootMargin: '-38% 0px -38% 0px' });
    col.current?.querySelectorAll('.blk').forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, [settings.focus]);

  /* ── annotations ── */
  const page = pages[curIdx];
  const makeAnno = (color: HlColor): Annotation | null => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount || !col.current) return null;
    const res = selectionToSegments(s.getRangeAt(0), col.current);
    if (!res) return null;
    const pg = pages.find((p) => p.id === res.segments[0].pageId) ?? page;
    const now = Date.now();
    return { id: uid(), chapterId: entry.id, pageId: pg.id, bookPage: pg.bookPage, pdfPage: pg.pdfPage, color, note: '', quote: res.quote, segments: res.segments, created: now, updated: now };
  };
  const highlight = (c: HlColor) => {
    const a = makeAnno(c); if (!a) return;
    putAnnotation(a); requestPersistence(); update({ lastColor: c }); window.getSelection()?.removeAllRanges();
  };
  const startNote = () => {
    const s = window.getSelection(); const rect = s?.rangeCount ? s.getRangeAt(0).getBoundingClientRect() : null;
    const a = makeAnno(settings.lastColor); if (!a) return;
    s?.removeAllRanges(); setEditor({ anno: a, isNew: true, rect, opener: null });
  };
  const openAnno = useCallback((id: string, el: HTMLElement) => {
    const a = annos.find((x) => x.id === id); if (a) setEditor({ anno: a, isNew: false, rect: el.getBoundingClientRect(), opener: el });
  }, [annos]);
  const closeEditor = () => { editor?.opener?.focus(); setEditor(null); };
  const toggleBm = useCallback((pageId: string) => {
    const p = pageMap.get(pageId); if (p) toggleBookmark({ chapterId: entry.id, pageId: p.id, bookPage: p.bookPage, pdfPage: p.pdfPage, label: p.label });
  }, [entry.id, pageMap]);
  const actions = useMemo(() => ({ pages: pageMap, bookmarked: bmSet, openAnno, toggleBookmark: toggleBm, viewOriginal: (id: string) => { const p = pageMap.get(id); if (p) setImg({ pdfPage: p.pdfPage, label: p.label }); }, goRef }), [pageMap, bmSet, openAnno, toggleBm, goRef]);

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable],dialog')) return;
      if (e.altKey && /^Digit[1-4]$/.test(e.code)) { e.preventDefault(); highlight(HL_COLORS[Number(e.code.slice(5)) - 1]); return; }
      if (e.altKey && e.code === 'KeyN') { e.preventDefault(); startNote(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const go = (d: number) => { const p = pages[Math.max(0, Math.min(pages.length - 1, curIdx + d))]; jumpPage(p.id); };
      switch (e.key) {
        case ']': go(1); break; case '[': go(-1); break;
        case 'o': setSideOpen((v) => !v); break;
        case 'g': e.preventDefault(); setSideOpen(true); setTab('outline'); setTimeout(() => gotoRef.current?.focus(), 30); break;
        case 'b': toggleBm(page.id); break;
        case 'f': update({ focus: !settings.focus }); break;
        case 't': update({ theme: THEME_ORDER[(THEME_ORDER.indexOf(settings.theme) + 1) % 3] }); break;
        case 'Escape': if (settings.focus) update({ focus: false }); else setSideOpen(false); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onColClick = (e: React.MouseEvent) => {
    const m = (e.target as HTMLElement).closest<HTMLElement>('mark[data-anno]');
    if (m && window.getSelection()?.isCollapsed !== false) openAnno(m.dataset.anno!, m);
  };
  const onColKey = (e: React.KeyboardEvent) => {
    const m = (e.target as HTMLElement).closest<HTMLElement>('mark[data-anno]');
    if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAnno(m.dataset.anno!, m); }
  };

  const label = entry.number ? `Ch ${entry.number}` : entry.title;
  const last = pages[pages.length - 1];
  const bookmarked = bmSet.has(page.id);
  const clearFind = () => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n, { replace: true }); };

  return (
    <ReaderCtx.Provider value={actions}>
      <div className={`r-root${settings.focus ? ' focus' : ''}`}>
        <header className="r-bar">
          <Link to="/" className="icon-btn" aria-label="Back to library" title="Library"><Icon name="book" /></Link>
          <button className="icon-btn only-narrow" onClick={() => setSideOpen(true)} aria-label="Open outline"><Icon name="list" /></button>
          <div className="r-title">
            <strong>{label}</strong>{entry.number ? <span className="t">{entry.title}</span> : null}
          </div>
          <span className="pgind" aria-live="polite">Page {page.label}{last.bookPage != null && page.bookPage != null ? <span className="muted"> / {last.bookPage}</span> : null}</span>
          {q && <button className="chip" onClick={clearFind} title="Clear search highlights">“{q}” <Icon name="close" size={12} /></button>}
          <div className="grow" />
          <button className="icon-btn" disabled={!prev} onClick={() => prev && nav(`/read/${prev.id}`)} aria-label={prev ? `Previous: ${prev.title}` : 'No previous chapter'} title={prev ? `Previous: ${prev.title}` : ''}><Icon name="left" /></button>
          <button className="icon-btn" disabled={!next} onClick={() => next && nav(`/read/${next.id}`)} aria-label={next ? `Next: ${next.title}` : 'No next chapter'} title={next ? `Next: ${next.title}` : ''}><Icon name="right" /></button>
          <button className="icon-btn" onClick={openSearch} aria-label="Search (Ctrl/⌘ K)" title="Search"><Icon name="search" /></button>
          <button className="icon-btn" onClick={() => actions.viewOriginal(page.id)} aria-label="View original page" title="View original page"><Icon name="image" /></button>
          <button className="icon-btn" aria-pressed={bookmarked} onClick={() => toggleBm(page.id)} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'} title="Bookmark page (B)"><Icon name={bookmarked ? 'bookmarkFill' : 'bookmark'} /></button>
          <button className="icon-btn" data-settings-toggle aria-expanded={setOpen} onClick={() => setSetOpen((v) => !v)} aria-label="Reading comfort" title="Reading comfort"><Icon name="text" /></button>
          <button className="icon-btn" aria-pressed={settings.focus} onClick={() => update({ focus: !settings.focus })} aria-label="Focus mode" title="Focus mode (F)"><Icon name="focus" /></button>
          {setOpen && <ReaderSettings onClose={() => setSetOpen(false)} />}
        </header>
        {notice && <div className="toast" role="status">{notice}</div>}
        {settings.focus && <button className="btn focus-exit" onClick={() => update({ focus: false })}>Exit focus (Esc)</button>}
        <div className="r-grid">
          <Sidebar chapter={chapter} annos={annos} bookmarks={bookmarks} curHead={curHead} curIdx={curIdx} open={sideOpen} tab={tab} setTab={setTab} onClose={() => setSideOpen(false)} jumpBlock={jumpBlock} jumpPage={jumpPage} jumpAnno={jumpAnno} gotoRef={gotoRef} />
          <main className="r-main" id="main">
            <div className="r-col" ref={col} onClick={onColClick} onKeyDown={onColKey}>
              {entry.number == null || pages[0].kind !== 'chapter_opener' ? <h1 className="doc-title">{entry.title}</h1> : null}
              {chapter.blocks.map((b) => {
                const seen = new Set<Annotation>();
                blockParts(b).forEach((p) => annosByPart.get(`${p.pageId}:${p.pi}`)?.forEach((a) => seen.add(a)));
                const list = [...seen];
                const bm = anchorsOf(b).filter((id) => bmSet.has(id)).join();
                return <BlockRow key={b.key} b={b} annos={list} sig={list.map((a) => `${a.id}${a.updated}`).join()} find={findRe} findKey={q} bm={bm} />;
              })}
              <nav className="chap-nav" aria-label="Chapter navigation">
                {prev ? <Link to={`/read/${prev.id}`}><small>Previous</small><span>{prev.number ? `${prev.number}. ` : ''}{prev.title}</span></Link> : <span />}
                {next ? <Link to={`/read/${next.id}`} className="next"><small>Next</small><span>{next.number ? `${next.number}. ` : ''}{next.title}</span></Link> : <span />}
              </nav>
            </div>
          </main>
        </div>
        <SelectionBar col={col} lastColor={settings.lastColor} onHighlight={highlight} onNote={startNote} />
        {editor && <AnnoEditor state={editor} onClose={closeEditor} onSave={(a) => { putAnnotation(a); requestPersistence(); closeEditor(); }} onDelete={(id) => { deleteAnnotation(id); setEditor(null); }} />}
        <PageImageDialog page={img} onClose={() => setImg(null)} />
      </div>
    </ReaderCtx.Provider>
  );
}
