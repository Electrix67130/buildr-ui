import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS, LOCALES, Locale, TranslationKeys } from '@/i18n/translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKeys, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'app_locale';
// Derive de LOCALES plutot que reecrit a la main : la liste ecrite en dur avait
// arrete d'evoluer a cinq langues alors que le selecteur en propose huit. Un
// utilisateur qui choisissait le portugais, le turc ou le polonais le gardait
// pour la session, puis retombait en francais au redemarrage — sa langue etait
// stockee, mais relue puis rejetee ici.
const VALID: Locale[] = LOCALES.map((l) => l.code);

// Locale courante dupliquee hors de React. Elle sert aux quelques appelants qui
// ne peuvent pas consommer le contexte : un utilitaire hors composant, et
// surtout l'ErrorBoundary, dont l'ecran de secours doit s'afficher meme si c'est
// un provider qui a plante.
let currentLocale: Locale = 'fr';

function interpolate(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/**
 * Traduction hors React, dans la derniere locale connue. A n'utiliser que
 * lorsque useTranslation() est impossible : dans un composant, le hook reste la
 * bonne porte d'entree car lui seul redeclenche le rendu au changement de langue.
 */
export function translate(key: TranslationKeys, vars?: Record<string, string | number>): string {
  const raw = TRANSLATIONS[currentLocale][key] ?? TRANSLATIONS.fr[key] ?? key;
  return interpolate(raw, vars);
}

/**
 * Langue de l'appareil, si Buildr la parle. Lue via Intl plutot qu'en ajoutant
 * expo-localization : Hermes expose deja la locale systeme, et l'app s'en sert
 * pour les noms de mois. Enveloppe dans un try : sur une version d'Intl reduite,
 * resolvedOptions peut echouer, et l'absence de detection ne doit pas empecher
 * l'app de demarrer.
 */
function detectDeviceLocale(): Locale | null {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    const code = tag?.split('-')[0];
    return VALID.includes(code as Locale) ? (code as Locale) : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      // La preference enregistree prime toujours : un utilisateur qui a choisi
      // sa langue ne doit pas la voir changer parce qu'il a modifie celle du
      // telephone.
      if (stored && VALID.includes(stored as Locale)) {
        currentLocale = stored as Locale;
        setLocaleState(stored as Locale);
        return;
      }
      // Premier lancement : on suit la langue de l'appareil. Sans ca, l'app
      // s'ouvrait en francais pour tout le monde, et les huit traductions ne
      // servaient qu'a ceux qui pensaient a chercher le selecteur.
      const device = detectDeviceLocale();
      if (device) {
        currentLocale = device;
        setLocaleState(device);
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    currentLocale = next;
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKeys, vars?: Record<string, string | number>) => {
      const raw = TRANSLATIONS[locale][key] ?? TRANSLATIONS.fr[key] ?? key;
      // Interpolation {nom} : une traduction doit pouvoir placer la variable ou
      // sa langue l'exige, ce qu'un gabarit assemble dans le code interdit.
      return interpolate(raw, vars);
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
