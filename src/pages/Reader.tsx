import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadCatalog, loadChapter } from '../lib/data';
import { getProgress, listAnnotations, listBookmarks, putAnnotation, deleteAnnotation, toggleBookmark, uid, updateProgress, useLive, requestPersistence } from '../lib/db';
import { useSettings } from '../lib/settings';
import { buildFindRegex } from '../lib/segments';
import { selectionToSegments } from '../lib/anchors';
import type { Annotation, CatalogEntry, HlColor, ParsedChapter, ParsedPage } from '../lib/types';
import { HL_COLORS, type ThemeName } from '../lib/types';
import { PageSection, ReaderCtx } from '../components/Blocks';
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
  if (!entry || !chapter) return (<main className="center-msg" aria-busy="true"><p className="muted">Loading chapter…</p></main>);
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
  const col = useRef<HTMLDivElement>(null);
  const gotoRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);
  const q = sp.get('q') ?? '';
  const findRe = useMemo(() => buildFindRegex(q), [q]);
  const pages = chapter.pages;
  const bmSet = useMemo(() => new Set(bookmarks.map((b) => b.pageId)), [bookmarks]);
  const annosByPage = useMemo(() => {
    const m = new Map<string, Annotation[]>();
    annos.forEach((a) => new Set(a.segments.map((s) => s.pageId)).forEach((p) => m.set(p, [...(m.get(p) ?? []), a])));
    return m;
  }, [annos]);

  /* ── jumping ── */
  const scrollEl = (el: HTMLElement | null, block: ScrollLogicalPosition = 'start') => el?.scrollIntoView({ block, behavior: 'auto' });
  const jumpPage = useCallback((id: string) => scrollEl(document.getElementById(`pg-${id}`)), []);
  const jumpBlock = useCallback((key: string) => scrollEl(document.getElementById(`b-${key}`)), []);
  const jumpAnno = useCallback((id: string) => { const el = document.querySelector<HTMLElement>(`[data-anno="${id}"]`); scrollEl(el, 'center'); el?.focus({ preventScroll: true }); }, []);

  /* ── restore position (URL ?pg= wins, else saved progress) ── */
  useLayoutEffect(() => {
    history.scrollRestoration = 'manual';
    const pg = sp.get('pg');
    if (pg) {
      const sec = document.getElementById(`pg-${pg}`);
      const hit = sec?.querySelector<HTMLElement>('mark.find');
      if (hit) scrollEl(hit, 'center'); else scrollEl(sec);
      restored.current = true;
      const n = new URLSearchParams(sp); n.delete('pg'); setSp(n, { replace: true });
    } else {
      getProgress(entry.id).then((p) => {
        const sec = p?.pageId ? document.getElementById(`pg-${p.pageId}`) : null;
        if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - BAR_H - 8 + (p?.frac ?? 0) * sec.offsetHeight });
        restored.current = true;
      }).catch(() => { restored.current = true; });
    }
    return () => { history.scrollRestoration = 'auto'; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── scroll spy + save position ── */
  useEffect(() => {
    const el = col.current!;
    let pageTops: number[] = [], heads: { key: string; top: number }[] = [], raf = 0, timer = 0, ci = -1, ch: string | null = null;
    const measure = () => {
      pageTops = Array.from(el.querySelectorAll<HTMLElement>('section.page')).map((s) => s.getBoundingClientRect().top + window.scrollY);
      heads = Array.from(el.querySelectorAll<HTMLElement>('[data-h]')).map((h) => ({ key: h.closest('.blk')!.id.slice(2), top: h.getBoundingClientRect().top + window.scrollY }));
    };
    const pos = () => {
      const y = window.scrollY + BAR_H + 24;
      let i = 0; for (let k = 0; k < pageTops.length && pageTops[k] <= y; k++) i = k;
      let h: string | null = null; for (const x of heads) { if (x.top <= y) h = x.key; else break; }
      const height = Math.max(1, (pageTops[i + 1] ?? document.documentElement.scrollHeight) - pageTops[i]);
      return { i, h, frac: Math.max(0, Math.min(1, (window.scrollY + BAR_H + 8 - pageTops[i]) / height)) };
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
  }, [entry.id, pages]);

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
  const toggleBm = useCallback((p: ParsedPage) => { toggleBookmark({ chapterId: entry.id, pageId: p.id, bookPage: p.bookPage, pdfPage: p.pdfPage, label: p.label }); }, [entry.id]);
  const actions = useMemo(() => ({ openAnno, toggleBookmark: toggleBm, viewOriginal: (p: ParsedPage) => setImg({ pdfPage: p.pdfPage, label: p.label }) }), [openAnno, toggleBm]);

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
        case 'b': toggleBm(page); break;
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
  const first = pages[0], last = pages[pages.length - 1];
  const bookmarked = bmSet.has(page.id);
  const clearFind = () => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n, { replace: true }); };

  return (
    <ReaderCtx.Provider value={actions}>
      <div className={`r-root${settings.focus ? ' focus' : ''}`}>
        <header className="r-bar">
          <Link to="/" className="icon-btn" aria-label="Back to library" title="Library"><Icon name="book" /></Link>
          <button className="icon-btn only-narrow" onClick={() => setSideOpen(true)} aria-label="Open outline"><Icon name="list" /></button>
          <div className="r-title">
            <strong>{label}</strong><span className="t">{entry.number ? entry.title : ''}</span>
            <span className="pgind" aria-live="polite">p. {page.label}{first.bookPage != null && last.bookPage != null ? ` · ${first.bookPage}–${last.bookPage}` : ''}</span>
          </div>
          {q && <button className="chip" onClick={clearFind} title="Clear search highlights">“{q}” <Icon name="close" size={12} /></button>}
          <div className="grow" />
          <button className="icon-btn" disabled={!prev} onClick={() => prev && nav(`/read/${prev.id}`)} aria-label={prev ? `Previous: ${prev.title}` : 'No previous chapter'} title={prev ? `Previous: ${prev.title}` : ''}><Icon name="left" /></button>
          <button className="icon-btn" disabled={!next} onClick={() => next && nav(`/read/${next.id}`)} aria-label={next ? `Next: ${next.title}` : 'No next chapter'} title={next ? `Next: ${next.title}` : ''}><Icon name="right" /></button>
          <button className="icon-btn" onClick={openSearch} aria-label="Search (Ctrl/⌘ K)" title="Search"><Icon name="search" /></button>
          <button className="icon-btn" aria-pressed={bookmarked} onClick={() => toggleBm(page)} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'} title="Bookmark page (B)"><Icon name={bookmarked ? 'bookmarkFill' : 'bookmark'} /></button>
          <button className="icon-btn" data-settings-toggle aria-expanded={setOpen} onClick={() => setSetOpen((v) => !v)} aria-label="Reading comfort" title="Reading comfort"><Icon name="text" /></button>
          <button className="icon-btn" aria-pressed={settings.focus} onClick={() => update({ focus: !settings.focus })} aria-label="Focus mode" title="Focus mode (F)"><Icon name="focus" /></button>
          {setOpen && <ReaderSettings onClose={() => setSetOpen(false)} />}
        </header>
        {settings.focus && <button className="btn focus-exit" onClick={() => update({ focus: false })}>Exit focus (Esc)</button>}
        <div className="r-grid">
          <Sidebar chapter={chapter} annos={annos} bookmarks={bookmarks} curHead={curHead} curIdx={curIdx} open={sideOpen} tab={tab} setTab={setTab} onClose={() => setSideOpen(false)} jumpBlock={jumpBlock} jumpPage={jumpPage} jumpAnno={jumpAnno} gotoRef={gotoRef} />
          <main className="r-main" id="main">
            <div className="r-col" ref={col} onClick={onColClick} onKeyDown={onColKey}>
              {entry.number == null || pages[0].kind !== 'chapter_opener' ? <h1 className="doc-title">{entry.title}</h1> : null}
              {pages.map((p, i) => {
                const list = annosByPage.get(p.id) ?? [];
                return <PageSection key={p.id} page={p} idx={i} annos={list} sig={list.map((a) => `${a.id}${a.updated}`).join()} find={findRe} findKey={q} bookmarked={bmSet.has(p.id)} />;
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
