import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeSetting = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/**
 * "System" follows the clock, not the OS: dark from 7:00 PM until 7:00 AM,
 * light the rest of the day. index.html repeats these hours so the first paint
 * is already in the right theme; keep the two in step.
 */
export const DARK_FROM_HOUR = 19;
export const LIGHT_FROM_HOUR = 7;

const STORAGE_KEY = 'theme';
const THEME_COLOR: Record<Theme, string> = { light: '#101c36', dark: '#000000' };

export function themeAt(date: Date): Theme {
  const h = date.getHours();
  return h >= DARK_FROM_HOUR || h < LIGHT_FROM_HOUR ? 'dark' : 'light';
}

function readSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Storage blocked: fall through to the default.
  }
  return 'system';
}

function resolve(setting: ThemeSetting): Theme {
  return setting === 'system' ? themeAt(new Date()) : setting;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

interface ThemeValue {
  setting: ThemeSetting;
  theme: Theme;
  setSetting: (setting: ThemeSetting) => void;
}

const ThemeContext = createContext<ThemeValue>({
  setting: 'system',
  theme: 'light',
  setSetting: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>(readSetting);
  const [theme, setTheme] = useState<Theme>(() => resolve(readSetting()));

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, but still applied for this visit.
    }
  }, []);

  // System mode re-checks the clock every minute and when the tab comes back,
  // so the switch at 7 AM / 7 PM happens without a reload.
  useEffect(() => {
    const update = () => setTheme(resolve(setting));
    update();
    if (setting !== 'system') return;
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [setting]);

  useEffect(() => apply(theme), [theme]);

  // Another tab changed the setting.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettingState(readSetting());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <ThemeContext.Provider value={{ setting, theme, setSetting }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
