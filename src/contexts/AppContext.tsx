import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '@/lib/i18n';
import { t as translate, type TranslationKey } from '@/lib/i18n';

type Theme = 'light';

interface AppContextValue {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('erp_lang');
    return (saved === 'ru' || saved === 'uz') ? saved : 'uz';
  });

  const [theme] = useState<Theme>('light');

  useEffect(() => {
    localStorage.setItem('erp_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('erp_theme', 'light');
    document.documentElement.classList.remove('dark');
  }, []);

  const setLang = (l: Lang) => setLangState(l);
  const setTheme = () => {};
  const toggleTheme = () => {};
  const t = (key: TranslationKey) => translate(lang, key);

  return (
    <AppContext.Provider value={{ lang, theme, setLang, setTheme, toggleTheme, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
