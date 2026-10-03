import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Affichage des numeros de telephone.
 *
 * L'API les stocke et les renvoie en E.164 (`+33612345678`) : un seul format
 * en base, sans espaces ni separateurs, que les liens `tel:` prennent tel quel.
 * C'est illisible pour un humain — a l'ecran on remet les espaces.
 *
 * Les numeros francais s'affichent au format national (`06 12 34 56 78`),
 * celui que tout le monde connait ; les autres gardent leur indicatif
 * (`+49 151 23456789`), sans quoi on ne saurait pas de quel pays ils sont.
 */
const HOME_COUNTRY = 'FR';

export function formatPhone(value?: string | null): string {
  if (!value) return '';
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed) return value;
  return parsed.country === HOME_COUNTRY ? parsed.formatNational() : parsed.formatInternational();
}
