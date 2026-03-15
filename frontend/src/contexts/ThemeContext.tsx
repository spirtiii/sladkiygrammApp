import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'space' | 'sunset' | 'dark' | 'light';

export interface ThemeColors {
  background_gradient: string[];
  primary: string;
  text: string;
  text_secondary: string;
  glass_bg: string;
  glass_border: string;
  message_in: string;
  message_out: string;
  nav_bg: string;
}

const themes: Record<ThemeName, ThemeColors> = {
  space: {
    background_gradient: ['#0a0a2e', '#1a1a4e', '#16163a'],
    primary: '#a855f7',
    text: '#e8dff5',
    text_secondary: '#9b8ec4',
    glass_bg: 'rgba(20, 15, 45, 0.75)',
    glass_border: 'rgba(168, 85, 247, 0.15)',
    message_in: 'rgba(50, 25, 80, 0.6)',
    message_out: 'rgba(168, 85, 247, 0.35)',
    nav_bg: 'rgba(10, 10, 46, 0.96)',
  },
  sunset: {
    background_gradient: ['#1a0a1e', '#2d1b3d', '#1e0e28'],
    primary: '#f472b6',
    text: '#fce7f3',
    text_secondary: '#c9a0b8',
    glass_bg: 'rgba(45, 20, 45, 0.7)',
    glass_border: 'rgba(244, 114, 182, 0.15)',
    message_in: 'rgba(60, 15, 45, 0.6)',
    message_out: 'rgba(244, 114, 182, 0.35)',
    nav_bg: 'rgba(26, 10, 30, 0.96)',
  },
  dark: {
    background_gradient: ['#0d0d0d', '#1a1a1a', '#111111'],
    primary: '#3b82f6',
    text: '#f0f0f0',
    text_secondary: '#888899',
    glass_bg: 'rgba(30, 30, 35, 0.8)',
    glass_border: 'rgba(59, 130, 246, 0.1)',
    message_in: 'rgba(40, 40, 50, 0.7)',
    message_out: 'rgba(59, 130, 246, 0.3)',
    nav_bg: 'rgba(13, 13, 13, 0.96)',
  },
  light: {
    background_gradient: ['#f5f7fa', '#e4e9f0', '#f0f2f5'],
    primary: '#6366f1',
    text: '#1a1a2e',
    text_secondary: '#64748b',
    glass_bg: 'rgba(255, 255, 255, 0.75)',
    glass_border: 'rgba(99, 102, 241, 0.15)',
    message_in: 'rgba(255, 255, 255, 0.9)',
    message_out: 'rgba(99, 102, 241, 0.2)',
    nav_bg: 'rgba(245, 247, 250, 0.96)',
  },
};

interface ThemeContextType {
  themeName: ThemeName;
  theme: ThemeColors;
  setThemeName: (name: ThemeName) => void;
  autoTheme: boolean;
  setAutoTheme: (v: boolean) => void;
  lang: string;
  setLang: (l: string) => void;
  globalNotifications: boolean;
  setGlobalNotifications: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'space', theme: themes.space, setThemeName: () => {},
  autoTheme: false, setAutoTheme: () => {}, lang: 'en', setLang: () => {},
  globalNotifications: true, setGlobalNotifications: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [themeName, setThemeNameState] = useState<ThemeName>('space');
  const [autoTheme, setAutoThemeState] = useState(false);
  const [lang, setLangState] = useState('en');
  const [globalNotifications, setGlobalNotificationsState] = useState(true);

  useEffect(() => {
    (async () => {
      const st = await AsyncStorage.getItem('sladkiy_theme');
      const sl = await AsyncStorage.getItem('sladkiy_lang');
      const sa = await AsyncStorage.getItem('sladkiy_auto_theme');
      const sn = await AsyncStorage.getItem('sladkiy_global_notif');
      if (st) setThemeNameState(st as ThemeName);
      if (sl) setLangState(sl);
      if (sa === 'true') setAutoThemeState(true);
      if (sn === 'false') setGlobalNotificationsState(false);
    })();
  }, []);

  useEffect(() => {
    if (!autoTheme) return;
    const check = () => { const h = new Date().getHours(); setThemeNameState(h >= 7 && h < 20 ? 'light' : 'dark'); };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [autoTheme]);

  const setThemeName = useCallback((n: ThemeName) => { setThemeNameState(n); AsyncStorage.setItem('sladkiy_theme', n); }, []);
  const setAutoTheme = useCallback((v: boolean) => { setAutoThemeState(v); AsyncStorage.setItem('sladkiy_auto_theme', v ? 'true' : 'false'); }, []);
  const setLang = useCallback((l: string) => { setLangState(l); AsyncStorage.setItem('sladkiy_lang', l); }, []);
  const setGlobalNotifications = useCallback((v: boolean) => { setGlobalNotificationsState(v); AsyncStorage.setItem('sladkiy_global_notif', v ? 'true' : 'false'); }, []);

  return (
    <ThemeContext.Provider value={{ themeName, theme: themes[themeName], setThemeName, autoTheme, setAutoTheme, lang, setLang, globalNotifications, setGlobalNotifications }}>
      {children}
    </ThemeContext.Provider>
  );
};
