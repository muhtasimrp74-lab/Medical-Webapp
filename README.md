# MedStudy — Phase 1: Textbook Reader

Study webapp for medical exams (MRCP, USMLE, professional exams). **Phase 1 = the textbook reader** for the
cleaned *Robbins Pathologic Basis of Disease* JSON. Later phases (questions, practice, review, stats, notes) have
routes, data models and IndexedDB stores already in place but no UI yet.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parser, anchoring, search index, render smoke tests (real data)
npm run build && npm run preview
```

Stack: Vite · React · TypeScript · react-router (HashRouter) · idb · MiniSearch · vite-plugin-pwa (Workbox).
HashRouter + relative base means it deploys to any static host or sub-path (a GitHub Pages workflow is included).

> **Copyright:** `public/data/` contains the book text and is committed here for testing. Make the repository private (or remove the data) if you do not hold the rights to publish it.

## Data
`public/data/` holds the JSON unchanged (`index.json`, `front_matter.json`, `back_matter.json`, `chapters/chNN.json`).
One file is fetched per route; only the 3 most recent chapters stay in memory. Only `paragraphs`, `tables_extracted`,
`tables`, `figure_text`, `book_page`, `pdf_page`, `kind` are read. Legacy text fields and `figure_text_noise` are ignored.
Page images (optional, later): `public/pages/{pdf_page}.webp`; until they exist "View original page" shows a placeholder.

### How text becomes blocks (`src/lib/parse.ts`)
Pure, tested, never modifies the data. Each rendered slice keeps `(paragraph index, offset)` so highlights anchor to raw text.
- running headers (`84 CHAPTER 3 …` / `CHAPTER 3 … 85`, also mid-page) are dropped; the page marker comes from `book_page`
- `•` → bullets, `1.` → numbered items, `Fig.` → figure cards, `TABLE x.y` → caption + real HTML table (from `tables_extracted`, placed after its caption)
- short unpunctuated lines → headings (ALL-CAPS = level 2, Title Case = level 3); `MORPHOLOGY` / `KEY CONCEPTS` → side labels; fragments that also appear in `figure_text` are not headings
- pages are stitched into **one continuous flow**: a paragraph or bullet that breaks across a page is completed as one paragraph (page anchors sit inside it, margin tags show the page on wide screens)
- figure/table boxes are **held back until the paragraph they landed in has ended**, so they never split a sentence
- `Fig. 3.4`, `Table 3.2`, `Chapter 5`, `Chapters 3 and 4` become links (same chapter: scroll + flash; other chapter: opens it at the figure/table)
- exam emphasis (`src/lib/lexicon.ts`): bold = high-yield terms (first mention per page, max 4/page, none on chapter intros); italic = organisms, gene symbols, Latin phrases. Edit the lists freely
- wrapped lines that start lower-case / with `-` are re-joined
- chapter opener: number + title become a hero; the extracted two-column contents lines and figure-label fragments are dropped

## Features (Phase 1)
Library by unit with per-chapter progress · continue / recent / bookmarks · continuous reader with outline, page margin
markers, jump-to-page (+ scrubber), prev/next chapter · font size, line width, line height, serif/sans, paper/sepia/dark,
focus mode, position restore · 4-colour highlights + margin notes on any selection (also across paragraphs/pages),
JSON export/import (merge or replace) · global search (Ctrl/⌘+K, MiniSearch in a Web Worker, index cached in IndexedDB;
first run builds it, ~3 s, ~10 MB) · keyboard shortcuts (see the Aa panel) · PWA: app shell precached, chapters/page
images cached as read (the search build also fetches every chapter once, which makes the whole book available offline).

## Layout
```
src/lib      types, parse, data, db (IndexedDB), settings, segments/anchors (highlights), backup, searchClient
src/workers  search.worker.ts
src/components  Blocks (renderers), Sidebar, Annotate, ReaderSettings, SearchDialog, DataPanel, Dialog, PageImageDialog
src/pages    Library, Reader, Stub (/questions /practice /review /stats /notes)
tests        parse · anchors (jsdom) · search (whole book) · render
```

## Phase 2+ readiness
`src/lib/types.ts` defines `Question` (`id, type mcq|saq|viva, exam MRCP|USMLE|custom, stem, options[], answer, explanation, tags[], difficulty, sources[]`),
`Attempt`, `ReviewCard` (SM-2 fields), `StudyNote`. The IndexedDB schema (v1) already has `questions`, `attempts`, `reviewCards`, `studyNotes`,
included in backup export/import. `sources[]` deep-links to `#/read/:chapterId?pg=:pageId`.

## Assumptions
- Units are not in the book's TOC, so `src/lib/units.ts` groups General pathology (1-10) + systemic chapters by organ system; edit freely.
- Heading/continuation detection is heuristic (the text has no formatting). Known limit: two-column opener pages stay interleaved.
- Highlights/progress live only in the browser; use Export to move devices. The app requests persistent storage.
- The Question schema line in the brief was cut off after `difficulty`; `sources`, `markScheme` and timestamps were added.
