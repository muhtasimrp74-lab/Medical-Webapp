import type { AnnoSegment } from './types';

/** DOM selection → raw-paragraph offsets. Every rendered text slice is a `.part` with data-page/pi/off. */
export function selectionToSegments(range: Range, root: HTMLElement): { segments: AnnoSegment[]; quote: string } | null {
  if (!root.contains(range.commonAncestorContainer)) return null;
  const segments: AnnoSegment[] = [];
  const offsetIn = (part: HTMLElement, node: Node, offset: number) => {
    const r = document.createRange();
    r.selectNodeContents(part);
    r.setEnd(node, offset);
    return r.toString().length;
  };
  root.querySelectorAll<HTMLElement>('.part').forEach((part) => {
    if (!range.intersectsNode(part)) return;
    const text = part.textContent ?? '';
    let start = part.contains(range.startContainer) ? offsetIn(part, range.startContainer, range.startOffset) : 0;
    let end = part.contains(range.endContainer) ? offsetIn(part, range.endContainer, range.endOffset) : text.length;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end <= start) return;
    const off = Number(part.dataset.off ?? 0);
    segments.push({ pageId: part.dataset.page ?? '', pi: Number(part.dataset.pi), start: start + off, end: end + off });
  });
  if (!segments.length) return null;
  const quote = range.toString().replace(/\s+/g, ' ').trim().slice(0, 400);
  return { segments, quote };
}
