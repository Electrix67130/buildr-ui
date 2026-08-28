/**
 * Libelles de calendrier derives de la locale courante.
 *
 * Les noms de mois et de jours existent deja dans les 8 langues cote plateforme
 * (API Intl) : les recopier dans le fichier de traductions ajouterait 19 cles a
 * maintenir pour aucun gain.
 */
import type { Locale } from '@/i18n/translations';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nom complet du mois, capitalise — Intl le renvoie en minuscules en francais. */
export function monthLabel(locale: Locale, year: number, month: number): string {
  return capitalize(new Date(year, month, 1).toLocaleDateString(locale, { month: 'long' }));
}

/**
 * Abreviations des jours de la semaine, du lundi au dimanche (ordre des grilles
 * de l'app). Le 1er janvier 2024 etait un lundi : il sert de point de depart.
 */
export function weekDayLabels(locale: Locale): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    capitalize(
      new Date(Date.UTC(2024, 0, 1 + i))
        .toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
        .replace(/\.$/, ''),
    ),
  );
}
