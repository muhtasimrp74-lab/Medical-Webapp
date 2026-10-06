import { Fragment, createContext, memo, useContext, useMemo, type ReactNode } from 'react';
import type { Annotation, Block, ParsedPage, Part } from '../lib/types';
import { joiner } from '../lib/parse';
import { findMarks, segmentize, type Mark } from '../lib/segments';
import { Icon } from './Icon';

export interface ReaderActions {
  openAnno: (id: string, el: HTMLElement) => void;
  toggleBookmark: (page: ParsedPage) => void;
  viewOriginal: (page: ParsedPage) => void;
}
export const ReaderCtx = createContext<ReaderActions>({ openAnno: () => {}, toggleBookmark: () => {}, viewOriginal: () => {} });

type MarkMap = Map<number, Mark[]>;

function Text({ pageId, parts, marks, find }: { pageId: string; parts: Part[]; marks: MarkMap; find: RegExp | null }) {
  return (
    <>
      {parts.map((p, i) => {
        const segs = segmentize(p.text, p.off, [...(marks.get(p.pi) ?? []), ...findMarks(p.text, p.off, find)]);
        return (
          <Fragment key={`${p.pi}:${p.off}`}>
            {i > 0 && joiner(p)}
            <span className="part" data-page={pageId} data-pi={p.pi} data-off={p.off}>
              {segs.map((s, j) =>
                s.annoId ? (
                  <mark key={j} className={`hl hl-${s.color}${s.note ? ' has-note' : ''}${s.find ? ' find' : ''}`} data-anno={s.annoId} tabIndex={0} role="button" aria-label={s.note ? 'Highlight with note. Press Enter to edit.' : 'Highlight. Press Enter to edit.'}>{s.text}</mark>
                ) : s.find ? (
                  <mark key={j} className="find">{s.text}</mark>
                ) : (
                  s.text
                ),
              )}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}

function BlockView({ b, pageId, marks, find, onView }: { b: Block; pageId: string; marks: MarkMap; find: RegExp | null; onView: () => void }) {
  const text = (parts: Part[]) => <Text pageId={pageId} parts={parts} marks={marks} find={find} />;
  switch (b.t) {
    case 'hero':
      return (<header className="hero"><span className="hero-no" aria-hidden="true">{b.number}</span><h1>{b.title}</h1></header>);
    case 'contents':
      return (
        <details className="contents">
          <summary>Chapter contents <span className="muted">(two columns, as extracted)</span></summary>
          <ul>{b.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
      );
    case 'h':
      return b.level === 2 ? <h2 data-h>{text(b.parts)}</h2> : <h3 data-h>{text(b.parts)}</h3>;
    case 'label':
      return <div className="side-label" role="presentation">{text(b.parts)}</div>;
    case 'p':
      return <p className={b.cont ? 'cont' : undefined}>{text(b.parts)}</p>;
    case 'li':
      return (
        <p className={`li${b.cont ? ' cont' : ''}`}>
          <span className="li-mark" aria-hidden="true">{b.num ? `${b.num}.` : '•'}</span>
          <span className="li-body">{text(b.parts)}</span>
        </p>
      );
    case 'fig':
      return (
        <figure className="fig-card">
          <div className="fig-head">
            <Icon name="figure" size={18} />
            <strong>{b.figLabel}</strong>
            <button className="btn small" onClick={onView}><Icon name="image" size={16} /> View original page</button>
          </div>
          <figcaption>{text(b.parts)}</figcaption>
          {b.labels.length > 0 && (
            <details className="fig-labels"><summary>Labels in figure ({b.labels.length})</summary><p>{b.labels.join(' · ')}</p></details>
          )}
        </figure>
      );
    case 'tcap':
      return (<p className="tcap"><strong>Table {b.tableId}</strong> {text(b.parts)}</p>);
    case 'table': {
      const [head, ...rows] = b.rows;
      return (
        <div className="tbl-wrap" role="region" aria-label={b.tableId ? `Table ${b.tableId}` : 'Table'} tabIndex={0}>
          <table>
            <thead><tr>{head.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
  }
}

interface PageProps {
  page: ParsedPage; idx: number; annos: Annotation[]; sig: string; find: RegExp | null; findKey: string; bookmarked: boolean;
}

export const PageSection = memo(function PageSection({ page, idx, annos, find, bookmarked }: PageProps) {
  const act = useContext(ReaderCtx);
  const { marks, notes } = useMemo(() => {
    const marks: MarkMap = new Map();
    const notes = new Map<number, Annotation[]>(); // keyed by first paragraph index of the annotation on this page
    annos.forEach((a, order) => {
      a.segments.forEach((s) => {
        if (s.pageId !== page.id) return;
        const list = marks.get(s.pi) ?? [];
        list.push({ start: s.start, end: s.end, order: a.created + order, annoId: a.id, color: a.color, note: !!a.note });
        marks.set(s.pi, list);
      });
      const first = a.segments.find((s) => s.pageId === page.id);
      if (a.note && first) notes.set(first.pi, [...(notes.get(first.pi) ?? []), a]);
    });
    return { marks, notes };
  }, [annos, page.id]);

  const view = () => act.viewOriginal(page);
  return (
    <section id={`pg-${page.id}`} className="page" data-idx={idx} data-page={page.id} aria-label={`Page ${page.label}`}>
      <div className="pg-marker">
        <span className="pg-no">p. {page.label}</span>
        <button className="icon-btn tiny" onClick={() => act.toggleBookmark(page)} aria-pressed={bookmarked} aria-label={bookmarked ? `Remove bookmark on page ${page.label}` : `Bookmark page ${page.label}`} title="Bookmark this page">
          <Icon name={bookmarked ? 'bookmarkFill' : 'bookmark'} size={16} />
        </button>
        <button className="icon-btn tiny" onClick={view} aria-label={`View original page ${page.label}`} title="View original page"><Icon name="image" size={16} /></button>
      </div>
      {page.blocks.map((b) => {
        const pis = 'parts' in b ? b.parts.map((p) => p.pi) : [];
        const bn: ReactNode[] = pis.flatMap((pi) => (notes.get(pi) ?? []).map((a) => (
          <button key={a.id} className={`mnote hl-${a.color}`} onClick={(e) => act.openAnno(a.id, e.currentTarget)} aria-label={`Margin note: ${a.note}`}>
            <Icon name="note" size={14} /> <span>{a.note}</span>
          </button>
        )));
        return (
          <div className="blk" key={b.key} id={`b-${b.key}`}>
            <BlockView b={b} pageId={page.id} marks={marks} find={find} onView={view} />
            {bn.length > 0 && <aside className="margin-notes" aria-label="Notes">{bn}</aside>}
          </div>
        );
      })}
    </section>
  );
}, (a, b) => a.page === b.page && a.sig === b.sig && a.findKey === b.findKey && a.bookmarked === b.bookmarked);
