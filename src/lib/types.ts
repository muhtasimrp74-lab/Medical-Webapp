/* ───────────── Raw data (public/data/*.json — never modified) ───────────── */
export type PageKind = 'body' | 'chapter_opener' | 'front_matter' | 'back_matter';

export interface RawPage {
  id: string;
  pdf_page: number;
  book_page: number | null;
  kind: PageKind;
  paragraphs: string[];
  tables?: string[];
  figures?: string[];
  tables_extracted?: string[][][];
  figure_text?: string[];
  paragraph_status?: string;
  // legacy / noisy fields (text_final*, text_layout*, layout_v2, figure_text_noise …) are never read.
}
export interface RawChapter {
  format: string;
  chapter_number?: number;
  title?: string;
  pdf_pages?: [number, number];
  book_pages?: [number, number];
  pages: RawPage[];
}
export interface IndexChapter {
  number: number; title: string; file: string;
  pdf_pages: [number, number]; book_pages: [number, number]; page_count: number;
  tables?: string[];
}
export interface BookIndex {
  source: string; format: string; pdf_page_to_book_page_offset: number;
  chapters: IndexChapter[]; front_matter_file: string; back_matter_file: string;
}

/** 'ch01'…'ch29' | 'front' | 'back' */
export type ChapterId = string;
export interface CatalogEntry {
  id: ChapterId; number: number | null; title: string; file: string;
  pdfPages: [number, number] | null; bookPages: [number, number] | null;
  pageCount: number; unit: string;
}

/* ───────────── Parsed reader model ───────────── */
/** A slice of one raw paragraph. `off` = characters stripped from the start (e.g. "• "). */
export interface Part { pi: number; off: number; text: string }

export type Block =
  | { t: 'hero'; key: string; number: string; title: string }
  | { t: 'contents'; key: string; lines: string[] }
  | { t: 'h'; key: string; level: 2 | 3; parts: Part[]; text: string }
  | { t: 'label'; key: string; parts: Part[] }
  | { t: 'p'; key: string; parts: Part[]; cont?: boolean }
  | { t: 'li'; key: string; parts: Part[]; num?: string; cont?: boolean }
  | { t: 'fig'; key: string; parts: Part[]; figLabel: string; labels: string[] }
  | { t: 'tcap'; key: string; parts: Part[]; tableId?: string }
  | { t: 'table'; key: string; rows: string[][]; tableId?: string };

export interface ParsedPage {
  id: string; pdfPage: number; bookPage: number | null; label: string; kind: PageKind; blocks: Block[];
}
export interface OutlineItem { key: string; text: string; level: 2 | 3; pageId: string; pageIdx: number; label: string }
export interface ParsedChapter {
  id: ChapterId; number: number | null; title: string; pages: ParsedPage[]; outline: OutlineItem[];
}

/* ───────────── User data (IndexedDB) ───────────── */
export type HlColor = 'yellow' | 'green' | 'blue' | 'pink';
export const HL_COLORS: HlColor[] = ['yellow', 'green', 'blue', 'pink'];
export interface AnnoSegment { pageId: string; pi: number; start: number; end: number } // raw-paragraph offsets
export interface Annotation {
  id: string; chapterId: ChapterId; pageId: string; bookPage: number | null; pdfPage: number;
  color: HlColor; note: string; quote: string; segments: AnnoSegment[]; created: number; updated: number;
}
export interface Bookmark { id: string; chapterId: ChapterId; pageId: string; bookPage: number | null; pdfPage: number; label: string; created: number }
export interface Progress {
  chapterId: ChapterId; readPages: number[]; total: number;
  pageId: string; pageIdx: number; bookPage: number | null; frac: number; updated: number;
}

export type ThemeName = 'paper' | 'sepia' | 'dark';
export interface Settings {
  theme: ThemeName; fontSize: number; lineHeight: number; measure: number;
  family: 'serif' | 'sans'; focus: boolean; lastColor: HlColor;
}
export const DEFAULT_SETTINGS: Settings = {
  theme: 'paper', fontSize: 18, lineHeight: 1.7, measure: 66, family: 'serif', focus: false, lastColor: 'yellow',
};

/* ───────────── Phase 2+ data models (stubs; stores exist in IndexedDB already) ───────────── */
export type QuestionType = 'mcq' | 'saq' | 'viva';
export type ExamName = 'MRCP' | 'USMLE' | 'custom';
export interface QuestionOption { id: string; text: string }
export interface Question {
  id: string;
  type: QuestionType;
  exam: ExamName;
  stem: string;
  options: QuestionOption[];            // empty for saq / viva
  answer: string | string[];            // option id(s) for mcq; model answer text for saq; examiner prompts for viva
  explanation: string;
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Optional deep links back into the textbook. */
  sources?: { chapterId: ChapterId; pageId: string; bookPage: number | null }[];
  markScheme?: { point: string; marks: number }[];   // saq / viva
  created: number; updated: number;
}
export interface Attempt {
  id: string; questionId: string; at: number; correct: boolean | null; response: string | string[];
  timeMs: number; mode: 'practice' | 'review' | 'exam';
}
/** SM-2 style scheduling state for the /review phase. */
export interface ReviewCard {
  id: string; questionId: string; due: number; interval: number; ease: number; reps: number; lapses: number; last?: number;
}
export interface StudyNote { id: string; title: string; body: string; tags: string[]; links: { chapterId: ChapterId; pageId: string }[]; created: number; updated: number }
