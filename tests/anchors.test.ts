// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { segmentize, buildFindRegex, findMarks } from '../src/lib/segments';
import { selectionToSegments } from '../src/lib/anchors';

describe('segmentize', () => {
  it('applies offsets relative to the raw paragraph (bullet prefix stripped)', () => {
    // raw: "• Sensors of cell damage" ; part.off = 2 ; highlight raw 2..9 = "Sensors"
    const segs = segmentize('Sensors of cell damage', 2, [{ start: 2, end: 9, order: 1, annoId: 'a', color: 'yellow' }]);
    expect(segs.map((s) => [s.text, s.annoId])).toEqual([['Sensors', 'a'], [' of cell damage', undefined]]);
  });
  it('overlaps: newest wins, find marks coexist', () => {
    const text = 'ab cdef gh';
    const segs = segmentize(text, 0, [
      { start: 0, end: 6, order: 1, annoId: 'old', color: 'blue' }, { start: 3, end: 8, order: 2, annoId: 'new', color: 'pink' },
      ...findMarks(text, 0, buildFindRegex('cd'))]);
    expect(segs.filter((s) => s.find).map((s) => s.text).join('')).toBe('cdef');
    expect(segs.filter((s) => s.find).every((s) => s.annoId === 'new')).toBe(true);
    expect(segs.map((s) => s.text).join('')).toBe(text);
  });
});

describe('selectionToSegments', () => {
  it('survives existing marks inside a part and multi-part selections', () => {
    document.body.innerHTML = `<div id="r">
      <span class="part" data-page="p1" data-pi="3" data-off="0">Hello <mark>brave</mark> new world</span>
      <span class="part" data-page="p1" data-pi="4" data-off="2">second part text</span></div>`;
    const root = document.getElementById('r')!;
    const parts = root.querySelectorAll('.part');
    const range = document.createRange();
    range.setStart(parts[0].lastChild!, 1);               // " new world" → after the space
    range.setEnd(parts[1].firstChild!, 6);                // "second"
    const res = selectionToSegments(range, root)!;
    expect(res.segments).toEqual([
      { pageId: 'p1', pi: 3, start: 12, end: 21 },        // "new world"
      { pageId: 'p1', pi: 4, start: 2, end: 8 },          // raw offset = off(2) + 0..6
    ]);
  });
});
