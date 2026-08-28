import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS, Locale, TranslationKeys } from '@/i18n/translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKeys, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'app_locale';
const VALID: Locale[] = ['fr', 'en', 'de', 'es', 'it'];

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && VALID.includes(stored as Locale)) {
        setLocaleState(stored as Locale);
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKeys, vars?: Record<string, string | number>) => {
      const raw = TRANSLATIONS[locale][key] ?? TRANSLATIONS.fr[key] ?? key;
      // Interpolation {nom} : une traduction doit pouvoir placer la variable ou
      // sa langue l'exige, ce qu'un gabarit assemble dans le code interdit.
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (m, name) =>
        name in vars ? String(vars[name]) : m,
      );
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
