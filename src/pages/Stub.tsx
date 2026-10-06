import { useEffect } from 'react';

const INFO: Record<string, { title: string; phase: string; text: string; model: string }> = {
  questions: { title: 'Question bank', phase: 'Phase 2', text: 'MCQ, written (SAQ) and viva questions for MRCP, USMLE or your own exam, linked back to textbook pages.', model: 'Question { id, type: mcq|saq|viva, exam: MRCP|USMLE|custom, stem, options[], answer, explanation, tags[], difficulty, sources[] }' },
  practice: { title: 'Practice', phase: 'Phase 3', text: 'Timed and untimed sessions filtered by exam, tag and difficulty.', model: 'Attempt { id, questionId, at, correct, response, timeMs, mode }' },
  review: { title: 'Review', phase: 'Phase 4', text: 'Spaced repetition: questions and highlights come back when you are about to forget them.', model: 'ReviewCard { id, questionId, due, interval, ease, reps, lapses }' },
  stats: { title: 'Stats', phase: 'Phase 5', text: 'Reading time, accuracy by topic and exam readiness.', model: 'Derived from progress + attempts + reviewCards' },
  notes: { title: 'Notes', phase: 'Phase 6', text: 'All your highlights and margin notes in one searchable place, plus free-form study notes linked to book pages.', model: 'StudyNote { id, title, body, tags[], links[] } · annotations already stored' },
};

export default function Stub({ kind }: { kind: keyof typeof INFO }) {
  const i = INFO[kind];
  useEffect(() => { document.title = `${i.title} · MedStudy`; }, [i.title]);
  return (
    <main className="wrap stub">
      <p className="chip">{i.phase} · not built yet</p>
      <h1>{i.title}</h1>
      <p>{i.text}</p>
      <p className="muted">The route and the IndexedDB store already exist, so no migration is needed later.</p>
      <pre className="model">{i.model}</pre>
    </main>
  );
}
