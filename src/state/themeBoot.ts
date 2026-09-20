/**
 * Applies the persisted theme to `<html>` synchronously at module load, before React renders, so a
 * light-theme user never sees a dark flash. Import this module FIRST in main.tsx.
 *
 * Theme values: 'dark' | 'light' | 'system'. 'system' follows `prefers-color-scheme` live.
 */
import type { Theme } from '../types';
import { NAMESPACE } from './persistence';

const UI_KEY = `${NAMESPACE}ui`;
const LEGACY_THEME_KEY = 'retroplan_theme';

export type ResolvedTheme = 'dark' | 'light';

export function isTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light' || v === 'system';
}

function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** 'system' → whatever the OS says right now. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

/** Reads the persisted theme (new store first, then the legacy key); defaults to 'system'. */
export function readPersistedTheme(): Theme {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const ui = JSON.parse(raw) as { theme?: unknown };
      if (isTheme(ui.theme)) return ui.theme;
    }
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (isTheme(legacy)) return legacy;
  } catch {
    /* no storage: fall through */
  }
  return 'system';
}

/** Sets the `dark`/`light` class and `color-scheme` on `<html>`. Returns the resolved theme. */
export function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle('light', resolved === 'light');
    root.style.colorScheme = resolved;
    root.dataset.theme = theme;
  }
  return resolved;
}

/** Calls `onChange` whenever the OS preference flips. Returns an unsubscribe function. */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => onChange(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  } catch {
    return () => {};
  }
}

// Boot: run once at import time.
export const bootTheme: Theme = readPersistedTheme();
applyTheme(bootTheme);
