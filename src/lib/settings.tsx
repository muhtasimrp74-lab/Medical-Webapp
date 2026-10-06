import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from './types';

const KEY = 'medstudy.settings';
const load = (): Settings => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT_SETTINGS; }
};
const Ctx = createContext<{ settings: Settings; update: (p: Partial<Settings>) => void }>({ settings: DEFAULT_SETTINGS, update: () => {} });
export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const update = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
    const r = document.documentElement;
    r.dataset.theme = settings.theme;
    r.style.setProperty('--fs', `${settings.fontSize}px`);
    r.style.setProperty('--lh', String(settings.lineHeight));
    r.style.setProperty('--measure', `${settings.measure}ch`);
    r.dataset.family = settings.family;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', { paper: '#3b2f77', sepia: '#5b4630', dark: '#101015' }[settings.theme]);
  }, [settings]);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
