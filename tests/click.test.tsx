// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

it('Library → click chapter → reader appears', async () => {
  vi.stubGlobal('fetch', async (u: string) => {
    const p = String(u).split('/data/')[1];
    const t = readFileSync(`public/data/${p}`, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(t) };
  });
  (Element.prototype as any).scrollIntoView = () => {};
  (window as any).ResizeObserver = class { observe() {} disconnect() {} };
  (window as any).IntersectionObserver = class { observe() {} disconnect() {} };
  window.matchMedia = ((() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any);
  window.location.hash = '#/';
  const { default: App } = await import('../src/App');
  render(<App />);
  const link = await screen.findByText('Inflammation and Repair', {}, { timeout: 5000 });
  fireEvent.click(link.closest('a')!);
  await waitFor(() => expect(document.querySelectorAll('span.pg-anchor[data-page]').length).toBeGreaterThan(0), { timeout: 8000 });
  console.log('HASH', window.location.hash, 'pages', document.querySelectorAll('span.pg-anchor[data-page]').length);
}, 20000);
