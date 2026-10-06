import { Fragment, createContext, memo, useContext, type ReactNode } from 'react';
import type { Annotation, Block, ParsedPage, Part } from '../lib/types';
import { joiner } from '../lib/parse';
import { emMarks, findMarks, refMarks, resolveRef, segmentize, type Mark } from '../lib/segments';
import { chapterIdFromNumber } from '../lib/units';
import { Icon } from './Icon';

export interface ReaderActions {
  pages: Map<string, ParsedPage>;
  bookmarked: Set<string>;
  openAnno: (id: string, el: HTMLElement) => void;
  toggleBookmark: (pageId: string) => void;
  viewOriginal: (pageId: string) => void;
  goRef: (ref: string) => void;
}
export const ReaderCtx = createContext<ReaderActions>({ pages: new Map(), bookmarked: new Set(), openAnno: () => {}, toggleBookmark: () => {}, viewOriginal: () => {}, goRef: () => {} });

const refHref = (ref: string) => {
  const { chapter, domId } = resolveRef(ref);
  return `#/read/${chapterIdFromNumber(chapter)}${domId ? `?ref=${domId}` : ''}`;
};

/** Zero-size page anchor + margin tag (wide screens only). Sits inside the text so paragraphs flow across page breaks. */
function Anchor({ id }: { id: string }) {
  const act = useContext(ReaderCtx);
  const pg = act.pages.get(id);
  if (!pg) return null;
  const on = act.bookmarked.has(id);
  return (
    <span className="pg-anchor" id={`pg-${id}`} data-page={id}>
      <span className="pg-tag">
        <span className="pg-no">p. {pg.label}</span>
        <button className="icon-btn tiny" onClick={() => act.toggleBookmark(id)} aria-pressed={on} aria-label={`${on ? 'Remove bookmark on' : 'Bookmark'} page ${pg.label}`} title="Bookmark this page"><Icon name={on ? 'bookmarkFill' : 'bookmark'} size={15} /></button>
        <button className="icon-btn tiny" onClick={() => act.viewOriginal(id)} aria-label={`View original page ${pg.label}`} title="View original page"><Icon name="image" size={15} /></button>
      </span>
    </span>
  );
}

type MarkMap = Map<string, Mark[]>; // key `${pageId}:${pi}`

function Text({ parts, marks, find }: { parts: Part[]; marks: MarkMap; find: RegExp | null }) {
  const act = useContext(ReaderCtx);
  return (
    <>
      {parts.map((p, i) => {
        const all = [...(marks.get(`${p.pageId}:${p.pi}`) ?? []), ...findMarks(p.text, p.off, find), ...refMarks(p.text, p.off), ...emMarks(p.em, p.off)];
        const segs = segmentize(p.text, p.off, all);
        return (
          <Fragment key={`${p.pageId}:${p.pi}:${p.off}`}>
            {i > 0 && joiner(p)}
            {p.pageStarts?.map((id) => <Anchor key={id} id={id} />)}
            <span className="part" data-page={p.pageId} data-pi={p.pi} data-off={p.off}>
              {segs.map((s, j) => {
                let node: ReactNode = s.text;
                if (s.i) node = <em className="kt-i">{node}</em>;
                if (s.b) node = <strong className="kt">{node}</strong>;
                if (s.annoId) node = <mark className={`hl hl-${s.color}${s.note ? ' has-note' : ''}${s.find ? ' find' : ''}`} data-anno={s.annoId} tabIndex={0} role="button" aria-label={s.note ? 'Highlight with note. Press Enter to edit.' : 'Highlight. Press Enter to edit.'}>{node}</mark>;
                else if (s.find) node = <mark className="find">{node}</mark>;
                if (s.ref) {
                  const ref = s.ref;
                  node = <a className="xref" href={refHref(ref)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); act.goRef(ref); }}>{node}</a>;
                }
                return <Fragment key={j}>{node}</Fragment>;
              })}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}

function BlockView({ b, marks, find, onView }: { b: Block; marks: MarkMap; find: RegExp | null; onView: () => void }) {
  const text = (parts: Part[]) => <Text parts={parts} marks={marks} find={find} />;
  switch (b.t) {
    case 'hero':
      return (<header className="hero"><span className="hero-no" aria-hidden="true">{b.number}</span><h1>{b.title}</h1></header>);
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
        <figure className="fig-card" id={`fig-${b.figId}`}>
          <div className="fig-head">
            <Icon name="figure" size={18} />
            <strong>{b.figLabel}</strong>
            <button className="btn small" onClick={onView}><Icon name="image" size={16} /> View original page</button>
          </div>
          <figcaption>{text(b.parts)}</figcaption>
        </figure>
      );
    case 'tcap':
      return (<p className="tcap" id={b.tableId ? `tbl-${b.tableId}` : undefined}><strong>Table {b.tableId}</strong> {text(b.parts)}</p>);
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

export const blockParts = (b: Block): Part[] => ('parts' in b ? b.parts : []);
/** Page ids anchored inside a block (block start or mid-paragraph). */
export const anchorsOf = (b: Block): string[] => [...(b.pageStarts ?? []), ...blockParts(b).flatMap((p) => p.pageStarts ?? [])];

interface RowProps { b: Block; annos: Annotation[]; sig: string; find: RegExp | null; findKey: string; bm: string }
export const BlockRow = memo(function BlockRow({ b, annos, find }: RowProps) {
  const act = useContext(ReaderCtx);
  const parts = blockParts(b);
  const marks: MarkMap = new Map();
  const notes: Annotation[] = [];
  annos.forEach((a, order) => {
    a.segments.forEach((s) => {
      const k = `${s.pageId}:${s.pi}`;
      if (!parts.some((p) => p.pageId === s.pageId && p.pi === s.pi)) return;
      const list = marks.get(k) ?? [];
      list.push({ start: s.start, end: s.end, order: a.created + order, annoId: a.id, color: a.color, note: !!a.note });
      marks.set(k, list);
    });
    const f = a.segments[0];
    if (a.note && f && parts.some((p) => p.pageId === f.pageId && p.pi === f.pi)) notes.push(a);
  });
  const firstPage = (b.pageStarts ?? [])[0];
  return (
    <div className="blk" id={`b-${b.key}`}>
      {b.pageStarts?.map((id) => <Anchor key={id} id={id} />)}
      <BlockView b={b} marks={marks} find={find} onView={() => act.viewOriginal(parts[0]?.pageId ?? firstPage)} />
      {notes.length > 0 && (
        <aside className="margin-notes" aria-label="Notes">
          {notes.map((a) => (
            <button key={a.id} className={`mnote hl-${a.color}`} onClick={(e) => act.openAnno(a.id, e.currentTarget)} aria-label={`Margin note: ${a.note}`}>
              <Icon name="note" size={14} /> <span>{a.note}</span>
            </button>
          ))}
        </aside>
      )}
    </div>
  );
}, (a, b) => a.b === b.b && a.sig === b.sig && a.findKey === b.findKey && a.bm === b.bm);
