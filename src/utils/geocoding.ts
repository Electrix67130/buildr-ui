/**
 * Recherche de villes et d'adresses de chantier, dans les quatre pays ouverts
 * par les CGU. Chaque pays passe par le registre officiel de ses adresses
 * quand il en publie un, gratuit et sans cle :
 *
 * - France : geo.api.gouv.fr et Base Adresse Nationale ;
 * - Suisse : swisstopo (api3.geo.admin.ch) ;
 * - Luxembourg : geoportail.lu (administration du cadastre) ;
 * - Belgique : Photon (OpenStreetMap). Le registre belge est reparti entre
 *   trois regions, sans API de recherche commune.
 */

export type Country = 'FR' | 'BE' | 'LU' | 'CH';

/** Rectangle qui couvre la Belgique (lon/lat), pour que Photon y cherche d'abord. */
const BELGIUM_BBOX = '2.5,49.45,6.45,51.55';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const SWISSTOPO_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const GEOPORTAIL_LU_URL = 'https://apiv3.geoportail.lu/fulltextsearch';

export interface CitySuggestion {
  name: string;
  country: Country;
  /**
   * Code officiel de la commune, qui filtre ses adresses : INSEE en France,
   * numero OFS en Suisse.
   */
  cityCode?: string;
  /** Vide hors de France, ou une commune a souvent plusieurs codes : l'adresse le fournira. */
  postalCode: string;
  /** Departement en France, province en Belgique, canton en Suisse. */
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

interface SwisstopoResult {
  attrs: {
    /** HTML : « <b>Lausanne (VD)</b> », « Avenue de la Gare 5 <b>1003 Lausanne</b> ». */
    label: string;
    /** Texte indexe, qui contient le numero OFS de la commune. */
    detail: string;
    featureId: string;
    lat: number;
    lon: number;
  };
}

interface GeoportailLuFeature {
  /** [ouest, sud, est, nord] pour une localite, objet vide pour une adresse. */
  bbox: number[] | Record<string, never>;
  geometry: { type: string; coordinates: unknown };
  properties: {
    /** « Belvaux (Bieles) », « 24, Rue de la Poste, L-4477 Belvaux ». */
    label: string;
  };
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
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-']/g, ' ').toLowerCase().trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

async function getJson<T>(fetchImpl: Fetch, url: string): Promise<T> {
  return (await (await fetchImpl(url)).json()) as T;
}

async function photon(fetchImpl: Fetch, params: Record<string, string>, layers: string[]): Promise<PhotonFeature[]> {
  const search = new URLSearchParams({ ...params, lang: 'fr' });
  for (const layer of layers) search.append('layer', layer);
  const data = await getJson<{ features?: PhotonFeature[] }>(fetchImpl, `${PHOTON_URL}?${search}`);
  return data.features ?? [];
}

async function searchFrenchCities(query: string, fetchImpl: Fetch): Promise<CitySuggestion[]> {
  const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,departement,centre&boost=population&limit=8`;
  const data = await getJson<GeoApiCommune[]>(fetchImpl, url);
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

async function searchBelgianCities(query: string, fetchImpl: Fetch): Promise<CitySuggestion[]> {
  const features = await photon(fetchImpl, { q: query, limit: '10', bbox: BELGIUM_BBOX }, ['city']);
  return features.flatMap((f) => {
    const { countrycode, name } = f.properties;
    if (countrycode !== 'BE' || !name) return [];
    const [lng, lat] = f.geometry.coordinates;
    return [{
      name,
      country: 'BE' as const,
      postalCode: f.properties.postcode ?? '',
      region: f.properties.county ?? f.properties.state ?? '',
      latitude: lat,
      longitude: lng,
    }];
  });
}

async function searchSwissCities(query: string, fetchImpl: Fetch): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({ searchText: query, type: 'locations', origins: 'gg25', limit: '8', sr: '4326' });
  const data = await getJson<{ results?: SwisstopoResult[] }>(fetchImpl, `${SWISSTOPO_URL}?${params}`);
  return (data.results ?? []).flatMap(({ attrs }) => {
    // « Lausanne (VD) » : la commune et son canton.
    const match = /^(.*) \(([A-Z]{2})\)$/.exec(stripTags(attrs.label));
    if (!match) return [];
    return [{
      name: match[1],
      country: 'CH' as const,
      cityCode: attrs.featureId,
      postalCode: '',
      region: match[2],
      latitude: attrs.lat,
      longitude: attrs.lon,
    }];
  });
}

/** « Burange (Dudelange) (Biereng) » : le dernier groupe est le nom luxembourgeois. */
function luxembourgLocalityName(label: string): string {
  return label.replace(/\s*\([^()]*\)$/, '').trim();
}

async function searchLuxembourgCities(query: string, fetchImpl: Fetch): Promise<CitySuggestion[]> {
  // Les localites, pas les communes : c'est la localite qui figure dans
  // l'adresse postale (Belvaux, pas Sanem).
  const params = new URLSearchParams({ query, limit: '8', layer: 'Localité' });
  const data = await getJson<{ features?: GeoportailLuFeature[] }>(fetchImpl, `${GEOPORTAIL_LU_URL}?${params}`);
  return (data.features ?? []).flatMap((f) => {
    if (!Array.isArray(f.bbox) || f.bbox.length !== 4) return [];
    const [west, south, east, north] = f.bbox;
    return [{
      name: luxembourgLocalityName(f.properties.label),
      country: 'LU' as const,
      postalCode: '',
      region: '',
      latitude: (south + north) / 2,
      longitude: (west + east) / 2,
    }];
  });
}

/**
 * Villes des quatre pays. Les noms qui commencent par la saisie passent
 * devant : sans ca, « Liege » serait noye sous les communes francaises.
 * Hors de France, seuls les noms qui contiennent la saisie restent : les
 * services suisse et luxembourgeois tolerent les fautes de frappe et
 * proposaient « Linger » pour « Liege ». Si un service ne repond pas, les
 * autres suffisent.
 */
export async function searchCities(query: string, fetchImpl: Fetch = fetch): Promise<CitySuggestion[]> {
  const settled = await Promise.allSettled([
    searchFrenchCities(query, fetchImpl),
    searchBelgianCities(query, fetchImpl),
    searchLuxembourgCities(query, fetchImpl),
    searchSwissCities(query, fetchImpl),
  ]);
  const q = normalize(query);
  const all = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((city) => city.country === 'FR' || normalize(city.name).includes(q))
    // geoportail.lu renvoie parfois deux fois la meme localite.
    .filter((city, i, list) => list.findIndex((o) => o.country === city.country && o.name === city.name && o.postalCode === city.postalCode) === i);
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
    const data = await getJson<{ features?: BanFeature[] }>(fetchImpl, `https://api-adresse.data.gouv.fr/search/?${params}`);
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

async function searchBelgianAddresses(query: string, city: CitySuggestion, fetchImpl: Fetch): Promise<AddressSuggestion[]> {
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

async function searchSwissAddresses(query: string, city: CitySuggestion, fetchImpl: Fetch): Promise<AddressSuggestion[]> {
  // Le nom de la commune dans la saisie oriente le classement, son numero OFS
  // ecarte les rues homonymes d'ailleurs.
  const params = new URLSearchParams({ searchText: `${query} ${city.name}`, type: 'locations', origins: 'address', limit: '20', sr: '4326' });
  const data = await getJson<{ results?: SwisstopoResult[] }>(fetchImpl, `${SWISSTOPO_URL}?${params}`);
  return (data.results ?? []).flatMap(({ attrs }) => {
    if (city.cityCode && !attrs.detail.split(' ').includes(city.cityCode)) return [];
    // « Avenue de la Gare 5 <b>1003 Lausanne</b> »
    const [street, locality = ''] = attrs.label.split('<b>');
    const match = /^(\d{4}) (.*)$/.exec(stripTags(locality));
    return [{
      name: stripTags(street),
      postalCode: match?.[1] ?? '',
      city: match?.[2] ?? city.name,
      latitude: attrs.lat,
      longitude: attrs.lon,
    }];
  }).slice(0, 8);
}

async function searchLuxembourgAddresses(query: string, city: CitySuggestion, fetchImpl: Fetch): Promise<AddressSuggestion[]> {
  // « Burange (Dudelange) » s'ecrit « Burange » dans les adresses.
  const locality = city.name.split(' (')[0];
  const params = new URLSearchParams({ query: `${query} ${locality}`, limit: '20', layer: 'Adresse' });
  const data = await getJson<{ features?: GeoportailLuFeature[] }>(fetchImpl, `${GEOPORTAIL_LU_URL}?${params}`);
  const addresses = (data.features ?? []).flatMap((f) => {
    // « 24, Rue de la Poste, L-4477 Belvaux »
    const match = /^(.+?), (.+), L-(\d{4}) (.+)$/.exec(f.properties.label);
    if (!match || f.geometry.type !== 'Point') return [];
    const [lng, lat] = f.geometry.coordinates as [number, number];
    return [{
      name: formatStreet('LU', match[2], match[1]),
      postalCode: match[3],
      city: match[4],
      latitude: lat,
      longitude: lng,
    }];
  });
  // Les adresses de la localite choisie ; a defaut les autres, avec leur
  // localite affichee (« Luxembourg-Gare » s'ecrit « Luxembourg » dans les adresses).
  const local = addresses.filter((a) => normalize(a.city) === normalize(locality));
  return (local.length > 0 ? local : addresses).slice(0, 8);
}

/** Adresses dans la ville choisie. */
export function searchAddresses(query: string, city: CitySuggestion, fetchImpl: Fetch = fetch): Promise<AddressSuggestion[]> {
  switch (city.country) {
    case 'FR':
      return city.cityCode ? searchFrenchAddresses(query, city.cityCode, fetchImpl) : Promise.resolve([]);
    case 'CH':
      return searchSwissAddresses(query, city, fetchImpl);
    case 'LU':
      return searchLuxembourgAddresses(query, city, fetchImpl);
    case 'BE':
      return searchBelgianAddresses(query, city, fetchImpl);
  }
}
