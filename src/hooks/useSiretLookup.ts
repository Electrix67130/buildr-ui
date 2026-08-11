import { useState } from 'react';

export interface SiretLookupResult {
  siret: string;
  name: string;
  legal_form: string | null;
  naf_code: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  vat_number: string | null;
}

interface ApiSiege {
  siret?: string;
  adresse?: string;
  numero_voie?: string;
  type_voie?: string;
  libelle_voie?: string;
  code_postal?: string;
  libelle_commune?: string;
  activite_principale?: string;
}

interface ApiMatchingEtab {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  numero_voie?: string;
  type_voie?: string;
  libelle_voie?: string;
  activite_principale?: string;
}

interface ApiResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  activite_principale?: string;
  siege?: ApiSiege;
  matching_etablissements?: ApiMatchingEtab[];
}

interface ApiResponse {
  results?: ApiResult[];
}

function computeFrVat(siren: string): string | null {
  if (!/^\d{9}$/.test(siren)) return null;
  const key = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  return `FR${key.toString().padStart(2, '0')}${siren}`;
}

function pickEtab(data: ApiResult, siret: string): ApiSiege | ApiMatchingEtab | undefined {
  if (data.siege?.siret === siret) return data.siege;
  return data.matching_etablissements?.find((e) => e.siret === siret) ?? data.siege;
}

function buildStreet(e: ApiSiege | ApiMatchingEtab | undefined): string | null {
  if (!e) return null;
  if (e.adresse) {
    const cp = e.code_postal ?? '';
    const city = e.libelle_commune ?? '';
    return e.adresse.replace(new RegExp(`\\s*${cp}\\s*${city}\\s*$`, 'i'), '').trim();
  }
  return [e.numero_voie, e.type_voie, e.libelle_voie].filter(Boolean).join(' ') || null;
}

export function useSiretLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (rawSiret: string): Promise<SiretLookupResult | null> => {
    const siret = rawSiret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(siret)) {
      setError('SIRET invalide (14 chiffres requis).');
      return null;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`,
      );
      if (!res.ok) throw new Error('Lookup failed');
      const data = (await res.json()) as ApiResponse;
      const first = data.results?.[0];
      if (!first) {
        setError('Entreprise introuvable.');
        return null;
      }
      const etab = pickEtab(first, siret);
      const street = buildStreet(etab);
      const siren = first.siren ?? siret.slice(0, 9);

      return {
        siret,
        name: first.nom_raison_sociale || first.nom_complet || '',
        legal_form: first.nature_juridique || null,
        naf_code:
          (etab?.activite_principale || first.activite_principale || null)
            ?.toUpperCase()
            .replace('.', '') || null,
        address: street,
        postal_code: etab?.code_postal || null,
        city: etab?.libelle_commune || null,
        vat_number: computeFrVat(siren),
      };
    } catch {
      setError('Erreur réseau lors de la recherche.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading, error };
}
