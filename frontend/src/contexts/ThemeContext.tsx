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
    background_gradient: ['#0f0c29', '#302b63', '#24243e'],
    primary: '#d946ef',
    text: '#e0d0ff',
    text_secondary: '#bbaadd',
    glass_bg: 'rgba(30, 20, 50, 0.7)',
    glass_border: 'rgba(255, 255, 255, 0.1)',
    message_in: 'rgba(60, 20, 90, 0.6)',
    message_out: 'rgba(217, 70, 239, 0.4)',
    nav_bg: 'rgba(15, 12, 41, 0.95)',
  },
  sunset: {
    background_gradient: ['#ff9966', '#ff5e62', '#9a366b'],
    primary: '#ffcc00',
    text: '#fff5e6',
    text_secondary: '#ffdab9',
    glass_bg: 'rgba(100, 30, 50, 0.6)',
    glass_border: 'rgba(255, 255, 255, 0.2)',
    message_in: 'rgba(100, 20, 40, 0.5)',
    message_out: 'rgba(255, 94, 98, 0.6)',
    nav_bg: 'rgba(154, 54, 107, 0.95)',
  },
  dark: {
    background_gradient: ['#232526', '#414345'],
    primary: '#4facfe',
    text: '#ffffff',
    text_secondary: '#9aaabb',
    glass_bg: 'rgba(40, 44, 52, 0.8)',
    glass_border: 'rgba(255, 255, 255, 0.05)',
    message_in: 'rgba(255, 255, 255, 0.1)',
    message_out: 'rgba(79, 172, 254, 0.4)',
    nav_bg: 'rgba(35, 37, 38, 0.95)',
  },
  light: {
    background_gradient: ['#e0eafc', '#cfdef3'],
    primary: '#007bff',
    text: '#333333',
    text_secondary: '#666666',
    glass_bg: 'rgba(255, 255, 255, 0.65)',
    glass_border: 'rgba(255, 255, 255, 0.8)',
    message_in: 'rgba(255, 255, 255, 0.8)',
    message_out: 'rgba(0, 123, 255, 0.3)',
    nav_bg: 'rgba(255, 255, 255, 0.95)',
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
  themeName: 'space',
  theme: themes.space,
  setThemeName: () => {},
  autoTheme: false,
  setAutoTheme: () => {},
  lang: 'en',
  setLang: () => {},
  globalNotifications: true,
  setGlobalNotifications: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [themeName, setThemeNameState] = useState<ThemeName>('space');
  const [autoTheme, setAutoThemeState] = useState(false);
  const [lang, setLangState] = useState('en');
  const [globalNotifications, setGlobalNotificationsState] = useState(true);

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem('sladkiy_theme');
      const savedLang = await AsyncStorage.getItem('sladkiy_lang');
      const savedAuto = await AsyncStorage.getItem('sladkiy_auto_theme');
      const savedNotif = await AsyncStorage.getItem('sladkiy_global_notif');
      if (savedTheme) setThemeNameState(savedTheme as ThemeName);
      if (savedLang) setLangState(savedLang);
      if (savedAuto === 'true') setAutoThemeState(true);
      if (savedNotif === 'false') setGlobalNotificationsState(false);
    })();
  }, []);

  useEffect(() => {
    if (!autoTheme) return;
    const hour = new Date().getHours();
    const isDay = hour >= 7 && hour < 20;
    setThemeNameState(isDay ? 'light' : 'dark');
    const interval = setInterval(() => {
      const h = new Date().getHours();
      const day = h >= 7 && h < 20;
      setThemeNameState(day ? 'light' : 'dark');
    }, 60000);
    return () => clearInterval(interval);
  }, [autoTheme]);

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem('sladkiy_theme', name);
  }, []);

  const setAutoTheme = useCallback((v: boolean) => {
    setAutoThemeState(v);
    AsyncStorage.setItem('sladkiy_auto_theme', v ? 'true' : 'false');
  }, []);

  const setLang = useCallback((l: string) => {
    setLangState(l);
    AsyncStorage.setItem('sladkiy_lang', l);
  }, []);

  const setGlobalNotifications = useCallback((v: boolean) => {
    setGlobalNotificationsState(v);
    AsyncStorage.setItem('sladkiy_global_notif', v ? 'true' : 'false');
  }, []);

  return (
    <ThemeContext.Provider value={{
      themeName,
      theme: themes[themeName],
      setThemeName,
      autoTheme,
      setAutoTheme,
      lang,
      setLang,
      globalNotifications,
      setGlobalNotifications,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
