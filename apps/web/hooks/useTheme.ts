'use client';
import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'sepia';
const STORAGE_KEY = 'lectio_theme';

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored ?? 'light';
    setThemeState(initial);
    document.documentElement.dataset['theme'] = initial === 'light' ? '' : initial;
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    document.documentElement.dataset['theme'] = t === 'light' ? '' : t;
  }

  return { theme, setTheme };
}
