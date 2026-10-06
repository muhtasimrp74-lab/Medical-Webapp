import type { BookIndex, CatalogEntry } from './types';

/**
 * The 11th edition's table of contents lists chapters only (no unit titles), so units are an
 * editable assumption: General Pathology (1–10) then Systemic Pathology grouped by organ system.
 */
export const UNITS: { title: string; blurb: string; chapters: [number, number] }[] = [
  { title: 'General pathology', blurb: 'Cells, injury, inflammation, genetics, immunity, neoplasia, infection', chapters: [1, 10] },
  { title: 'Cardiovascular', blurb: 'Vessels and heart', chapters: [11, 12] },
  { title: 'Blood and lymphoid tissue', blurb: 'White cell, red cell and bleeding disorders', chapters: [13, 14] },
  { title: 'Respiratory and head & neck', blurb: 'Lung, head and neck', chapters: [15, 16] },
  { title: 'Digestive system', blurb: 'GI tract, liver and gallbladder, pancreas', chapters: [17, 19] },
  { title: 'Urinary and genital systems', blurb: 'Kidney, lower urinary tract, male and female genital tract', chapters: [20, 22] },
  { title: 'Breast and endocrine', blurb: 'Breast, endocrine system', chapters: [23, 24] },
  { title: 'Skin and musculoskeletal', blurb: 'Skin, bones and joints, nerves and muscle', chapters: [25, 27] },
  { title: 'Nervous system and eye', blurb: 'CNS, eye', chapters: [28, 29] },
];

export const chapterIdFromNumber = (n: number) => `ch${String(n).padStart(2, '0')}`;
export const unitFor = (n: number) => UNITS.find((u) => n >= u.chapters[0] && n <= u.chapters[1])?.title ?? 'Other';

export function buildCatalog(index: BookIndex): CatalogEntry[] {
  const front: CatalogEntry = { id: 'front', number: null, title: 'Front matter', file: index.front_matter_file, pdfPages: null, bookPages: null, pageCount: 12, unit: 'Front and back matter' };
  const back: CatalogEntry = { id: 'back', number: null, title: 'Back matter', file: index.back_matter_file, pdfPages: null, bookPages: null, pageCount: 1, unit: 'Front and back matter' };
  const chapters = index.chapters.map<CatalogEntry>((c) => ({
    id: chapterIdFromNumber(c.number), number: c.number, title: c.title, file: c.file,
    pdfPages: c.pdf_pages, bookPages: c.book_pages, pageCount: c.page_count, unit: unitFor(c.number),
  }));
  return [front, ...chapters, back];
}
