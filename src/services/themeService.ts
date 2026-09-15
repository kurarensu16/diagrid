import { useState, useEffect } from 'react';

export type ThemeMode = 'blueprint' | 'dark' | 'light';

const THEME_STORAGE_KEY = 'diagrid_theme';

type ThemeListener = (theme: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

/** Color tokens resolved per-theme for use in JS/SVG contexts */
export interface ThemeColors {
  ink: string;
  inkSoft: string;
  paper: string;
  paperRaised: string;
  blueprint: string;
  signal: string;
  borderLine: string;
}

const THEME_COLOR_MAP: Record<ThemeMode, ThemeColors> = {
  blueprint: {
    ink: '#15191C',
    inkSoft: '#4A5359',
    paper: '#F6F7F5',
    paperRaised: '#FFFFFF',
    blueprint: '#1E5C8C',
    signal: '#D45B33',
    borderLine: '#D7DBD8',
  },
  dark: {
    ink: '#F0F6FC',
    inkSoft: '#8B949E',
    paper: '#0E1317',
    paperRaised: '#161D22',
    blueprint: '#388BFD',
    signal: '#F78166',
    borderLine: '#263038',
  },
  light: {
    ink: '#0F172A',
    inkSoft: '#64748B',
    paper: '#F8FAFC',
    paperRaised: '#FFFFFF',
    blueprint: '#2563EB',
    signal: '#EA580C',
    borderLine: '#E2E8F0',
  },
};

export const themeService = {
  getTheme: (): ThemeMode => {
    if (typeof window === 'undefined') return 'blueprint';
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (stored === 'blueprint' || stored === 'dark' || stored === 'light') {
      return stored;
    }
    return 'blueprint';
  },

  getColors: (theme?: ThemeMode): ThemeColors => {
    return THEME_COLOR_MAP[theme || themeService.getTheme()];
  },

  setTheme: (theme: ThemeMode): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
    // Notify all subscribers
    listeners.forEach(fn => fn(theme));
    themeService.applyCurrentRouteTheme(theme);
  },

  applyCurrentRouteTheme: (userTheme?: ThemeMode, isSignedIn = false): void => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const isAppRoute = (
      path.startsWith('/dashboard') ||
      path.startsWith('/project/') ||
      path.startsWith('/settings') ||
      path.startsWith('/editor/') ||
      path.startsWith('/admin') ||
      (path === '/templates' && isSignedIn)
    );

    if (isAppRoute) {
      const theme = userTheme || themeService.getTheme();
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.setAttribute('data-theme', 'blueprint');
      document.documentElement.classList.remove('dark');
    }
  },

  subscribe: (fn: ThemeListener): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  initTheme: (initialUserTheme?: ThemeMode): void => {
    themeService.applyCurrentRouteTheme(initialUserTheme);
  }
};

/** React hook — subscribe to theme changes and get resolved color tokens */
export function useTheme(): { theme: ThemeMode; colors: ThemeColors } {
  const [theme, setTheme] = useState<ThemeMode>(themeService.getTheme);

  useEffect(() => {
    const unsub = themeService.subscribe(setTheme);
    return unsub;
  }, []);

  return { theme, colors: THEME_COLOR_MAP[theme] };
}

// Immediately initialize theme on module load
if (typeof window !== 'undefined') {
  themeService.initTheme();
}
