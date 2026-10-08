/**
 * Recherche de villes et d'adresses de chantier.
 *
 * La France passe par les API de l'Etat (geo.api.gouv.fr, Base Adresse
 * Nationale) : ce sont les plus completes, mais elles ne connaissent que la
 * France. La Belgique, le Luxembourg et la Suisse, ouverts par les CGU, passent
 * par Photon (OpenStreetMap, sans cle). Sans lui, personne ne pouvait saisir
 * une adresse de chantier a Liege ou a Lausanne.
 */

export type Country = 'FR' | 'BE' | 'LU' | 'CH';

const FOREIGN_COUNTRIES: readonly Country[] = ['BE', 'LU', 'CH'];

/** Rectangle qui couvre la Belgique, le Luxembourg et la Suisse (lon/lat). */
const FOREIGN_BBOX = '2.5,45.8,10.5,51.6';

const PHOTON_URL = 'https://photon.komoot.io/api/';

export interface CitySuggestion {
  name: string;
  country: Country;
  /** Code INSEE, France seulement : la BAN filtre les adresses avec. */
  cityCode?: string;
  /** Vide quand OpenStreetMap ne le donne pas : l'adresse le fournira. */
  postalCode: string;
  /** Departement en France, province, canton ou district ailleurs. */
  region: string;
  latitude: number;
  longitude: number;
}

export interface AddressSuggestion {
  /** Numero et rue, dans l'ordre d'usage du pays. */
  name: string;
  postalCode: string;
  /** Commune de l'adresse : le rectangle de recherche deborde sur les voisines. */
  city: string;
  latitude: number;
  longitude: number;
}

type Fetch = (url: string) => Promise<{ json(): Promise<unknown> }>;

interface GeoApiCommune {
  nom: string;
  code: string;
  codesPostaux: string[];
  departement?: { nom: string };
  centre?: { coordinates: [number, number] };
}

interface BanFeature {
  properties: { name: string; postcode: string; city: string };
  geometry: { coordinates: [number, number] };
}

interface PhotonFeature {
  properties: {
    countrycode?: string;
    /** 'house', 'street', 'city'… */
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    county?: string;
    state?: string;
  };
  geometry: { coordinates: [number, number] };
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function isForeign(code: string | undefined): code is Country {
  return FOREIGN_COUNTRIES.includes(code as Country);
}

async function photon(fetchImpl: Fetch, params: Record<string, string>, layers: string[]): Promise<PhotonFeature[]> {
  const search = new URLSearchParams({ ...params, lang: 'fr' });
  for (const layer of layers) search.append('layer', layer);
  const data = (await (await fetchImpl(`${PHOTON_URL}?${search}`)).json()) as { features?: PhotonFeature[] };
  return data.features ?? [];
}

async function searchFrenchCities(query: string, fetchImpl: Fetch): Promise<CitySuggestion[]> {
  const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,departement,centre&boost=population&limit=8`;
  const data = (await (await fetchImpl(url)).json()) as GeoApiCommune[];
  return data.flatMap((commune) => {
    const [lng, lat] = commune.centre?.coordinates ?? [0, 0];
    return commune.codesPostaux.map((postalCode) => ({
      name: commune.nom,
      country: 'FR' as const,
      cityCode: commune.code,
      postalCode,
      region: commune.departement?.nom ?? '',
      latitude: lat,
      longitude: lng,
    }));
  });
}

async function searchForeignCities(query: string, fetchImpl: Fetch): Promise<CitySuggestion[]> {
  const features = await photon(fetchImpl, { q: query, limit: '10', bbox: FOREIGN_BBOX }, ['city']);
  return features.flatMap((f) => {
    const { countrycode, name } = f.properties;
    if (!isForeign(countrycode) || !name) return [];
    const [lng, lat] = f.geometry.coordinates;
    return [{
      name,
      country: countrycode,
      postalCode: f.properties.postcode ?? '',
      region: f.properties.county ?? f.properties.state ?? '',
      latitude: lat,
      longitude: lng,
    }];
  });
}

/**
 * Villes des quatre pays. Les noms qui commencent par la saisie passent
 * devant : sans ca, « Liege » serait noye sous les communes francaises.
 * Si un service ne repond pas, l'autre suffit.
 */
export async function searchCities(query: string, fetchImpl: Fetch = fetch): Promise<CitySuggestion[]> {
  const [fr, foreign] = await Promise.allSettled([
    searchFrenchCities(query, fetchImpl),
    searchForeignCities(query, fetchImpl),
  ]);
  const all = [
    ...(fr.status === 'fulfilled' ? fr.value : []),
    ...(foreign.status === 'fulfilled' ? foreign.value : []),
  ];
  const q = normalize(query);
  const rank = (city: CitySuggestion) => {
    const name = normalize(city.name);
    if (name === q) return 0;
    return name.startsWith(q) ? 1 : 2;
  };
  return all
    .map((city, i) => ({ city, i, r: rank(city) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ city }) => city)
    .slice(0, 10);
}

/** Numero avant la rue en France et au Luxembourg, apres en Belgique et en Suisse. */
export function formatStreet(country: Country, street: string, housenumber?: string): string {
  if (!housenumber) return street;
  return country === 'BE' || country === 'CH' ? `${street} ${housenumber}` : `${housenumber} ${street}`;
}

async function searchFrenchAddresses(query: string, cityCode: string, fetchImpl: Fetch): Promise<AddressSuggestion[]> {
  // Numeros d'abord, la rue seule si aucun numero ne correspond.
  for (const type of ['housenumber', 'street']) {
    const params = new URLSearchParams({ q: query, citycode: cityCode, limit: '8', type });
    const data = (await (await fetchImpl(`https://api-adresse.data.gouv.fr/search/?${params}`)).json()) as { features?: BanFeature[] };
    const results = (data.features ?? []).map((f) => ({
      name: f.properties.name,
      postalCode: f.properties.postcode,
      city: f.properties.city,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    }));
    if (results.length > 0) return results;
  }
  return [];
}

async function searchForeignAddresses(query: string, city: CitySuggestion, fetchImpl: Fetch): Promise<AddressSuggestion[]> {
  // Un rectangle d'une dizaine de kilometres autour de la ville choisie.
  const bbox = [city.longitude - 0.12, city.latitude - 0.08, city.longitude + 0.12, city.latitude + 0.08].join(',');
  const features = await photon(fetchImpl, { q: query, limit: '10', bbox }, ['house', 'street']);
  const seen = new Set<string>();
  return features.flatMap((f) => {
    const p = f.properties;
    // Une rue porte son nom dans `name`. Un commerce ou un monument y porte
    // le sien et sa rue dans `street` : sans rue, il n'a pas d'adresse.
    const street = p.type === 'street' ? p.name : p.street;
    if (p.countrycode !== city.country || !street) return [];
    const name = formatStreet(city.country, street, p.housenumber);
    const key = `${name}|${p.postcode ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      name,
      postalCode: p.postcode ?? city.postalCode,
      city: p.city ?? city.name,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    }];
  }).slice(0, 8);
}

/** Adresses dans la ville choisie. */
export function searchAddresses(query: string, city: CitySuggestion, fetchImpl: Fetch = fetch): Promise<AddressSuggestion[]> {
  return city.country === 'FR' && city.cityCode
    ? searchFrenchAddresses(query, city.cityCode, fetchImpl)
    : searchForeignAddresses(query, city, fetchImpl);
}
