import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'pa' | 'en';

const LanguageContext = createContext<{ lang: Lang; toggle: () => void }>({
  lang: 'en',
  toggle: () => {},
});

const STORAGE_KEY = 'lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'pa' || v === 'en') setLang(v);
      })
      .catch((e) => console.warn('Failed to read language preference', e));
  }, []);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === 'en' ? 'pa' : 'en';
      AsyncStorage.setItem(STORAGE_KEY, next).catch((e) =>
        console.warn('Failed to persist language preference', e),
      );
      return next;
    });
  }, []);

  const value = useMemo(() => ({ lang, toggle }), [lang, toggle]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
