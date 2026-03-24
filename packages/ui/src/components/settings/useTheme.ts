import { useEffect } from 'react';
import type { ThemeMode } from './SettingsModal.js';

/**
 * Applies the active theme by toggling the `dark` class on <html>.
 * When mode is 'system', listens to the OS preference.
 */
export function useTheme(mode: ThemeMode): void {
  useEffect(() => {
    const html = document.documentElement;

    function apply(dark: boolean) {
      html.classList.toggle('dark', dark);
    }

    if (mode === 'dark') {
      apply(true);
      return;
    }
    if (mode === 'light') {
      apply(false);
      return;
    }

    // mode === 'system'
    if (typeof window.matchMedia !== 'function') {
      apply(false);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);

    function onChange(e: MediaQueryListEvent) {
      apply(e.matches);
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);
}
