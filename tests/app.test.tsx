// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, waitFor } from '@testing-library/react';

it('opens a chapter from the hash route and finishes loading', async () => {
  vi.stubGlobal('fetch', async (u: string) => {
    const p = String(u).split('/data/')[1];
    try { const t = readFileSync(`public/data/${p}`, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(t) }; }
    catch { return { ok: false, status: 404, json: async () => ({}) }; }
  });
  (Element.prototype as any).scrollIntoView = () => {};
  (window as any).ResizeObserver = class { observe() {} disconnect() {} };
  (window as any).IntersectionObserver = class { observe() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any);
  window.location.hash = '#/read/ch03';
  const { default: App } = await import('../src/App');
  render(<App />);
  await waitFor(() => expect(document.querySelectorAll('span.pg-anchor[data-page]').length).toBeGreaterThan(0), { timeout: 8000 }).catch(() => {});
  console.log('BODY:', document.body.textContent?.slice(0, 300));
  expect(document.querySelectorAll('span.pg-anchor[data-page]').length).toBe(36);
}, 20000);
