import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsProvider } from './lib/settings';
import { TopNav } from './components/TopNav';
import { SearchDialog } from './components/SearchDialog';
import Library from './pages/Library';
import Stub from './pages/Stub';

const Reader = lazy(() => import('./pages/Reader'));

function Shell() {
  const reading = useLocation().pathname.startsWith('/read/');
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {!reading && <TopNav />}
      <Suspense fallback={<main className="center-msg" aria-busy="true"><p className="muted">Loading…</p></main>}>
        <Routes>
          <Route path="/" element={<div id="main"><Library /></div>} />
          <Route path="/read/:chapterId" element={<Reader />} />
          <Route path="/questions" element={<Stub kind="questions" />} />
          <Route path="/practice" element={<Stub kind="practice" />} />
          <Route path="/review" element={<Stub kind="review" />} />
          <Route path="/stats" element={<Stub kind="stats" />} />
          <Route path="/notes" element={<Stub kind="notes" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <SearchDialog />
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <HashRouter><Shell /></HashRouter>
    </SettingsProvider>
  );
}
