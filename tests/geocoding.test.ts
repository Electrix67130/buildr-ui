/**
 * Recherche de villes et d'adresses de chantier.
 *
 * Les CGU ouvrent Buildr a la France, la Belgique, le Luxembourg et la Suisse,
 * mais la recherche ne connaissait que la France : un chantier a Liege ou a
 * Lausanne ne pouvait pas avoir d'adresse. Chaque pays passe par son registre
 * officiel quand il en publie un (BAN, swisstopo, geoportail.lu), la Belgique
 * par Photon (OpenStreetMap).
 */
import { searchCities, searchAddresses, formatStreet, CitySuggestion } from '@/utils/geocoding';

type Service = 'geo' | 'ban' | 'photon' | 'swisstopo' | 'lu';
type Routes = { geo?: unknown; ban?: unknown[]; photon?: unknown; swisstopo?: unknown; lu?: unknown; fail?: Service[] };

function serviceOf(url: string): Service {
  if (url.includes('geo.api.gouv.fr')) return 'geo';
  if (url.includes('api-adresse')) return 'ban';
  if (url.includes('geo.admin.ch')) return 'swisstopo';
  if (url.includes('geoportail.lu')) return 'lu';
  return 'photon';
}

/** Faux fetch : repond selon le service appele et garde les URL demandees. */
function fakeFetch(routes: Routes) {
  const urls: string[] = [];
  let ban = 0;
  const empty: Record<Service, unknown> = { geo: [], ban: { features: [] }, photon: { features: [] }, swisstopo: { results: [] }, lu: { features: [] } };
  const impl = async (url: string) => {
    urls.push(url);
    const service = serviceOf(url);
    if (routes.fail?.includes(service)) throw new Error('hors ligne');
    let body: unknown;
    if (service === 'ban') {
      body = routes.ban?.[ban];
      ban += 1;
    } else {
      body = routes[service];
    }
    return { json: async () => body ?? empty[service] };
  };
  return { impl, urls };
}

function photonFeature(properties: Record<string, string>, coords: [number, number] = [5.57, 50.64]) {
  return { properties, geometry: { coordinates: coords } };
}

function swiss(label: string, detail: string, featureId = '', lat = 46.52, lon = 6.63) {
  return { attrs: { label, detail, featureId, lat, lon } };
}

function luLocality(label: string, bbox = [5.92, 49.50, 5.94, 49.52]) {
  return { bbox, geometry: { type: 'Polygon', coordinates: [] }, properties: { label } };
}

function luAddress(label: string, coords: [number, number] = [5.93, 49.51]) {
  return { bbox: {}, geometry: { type: 'Point', coordinates: coords }, properties: { label } };
}

const liege: CitySuggestion = {
  name: 'Liège', country: 'BE', postalCode: '4000', region: 'Liège', latitude: 50.64, longitude: 5.57,
};
const lausanne: CitySuggestion = {
  name: 'Lausanne', country: 'CH', cityCode: '5586', postalCode: '', region: 'VD', latitude: 46.52, longitude: 6.63,
};
const belvaux: CitySuggestion = {
  name: 'Belvaux', country: 'LU', postalCode: '', region: '', latitude: 49.51, longitude: 5.93,
};

describe('Villes', () => {
  it('une commune francaise donne une suggestion par code postal, avec son code INSEE', async () => {
    const { impl } = fakeFetch({
      geo: [{ nom: 'Nancy', code: '54395', codesPostaux: ['54000', '54100'], departement: { nom: 'Meurthe-et-Moselle' }, centre: { coordinates: [6.18, 48.69] } }],
    });

    const cities = await searchCities('Nancy', impl);

    expect(cities).toEqual([
      { name: 'Nancy', country: 'FR', cityCode: '54395', postalCode: '54000', region: 'Meurthe-et-Moselle', latitude: 48.69, longitude: 6.18 },
      { name: 'Nancy', country: 'FR', cityCode: '54395', postalCode: '54100', region: 'Meurthe-et-Moselle', latitude: 48.69, longitude: 6.18 },
    ]);
  });

  it('une ville belge vient de Photon, qui ignore les autres pays', async () => {
    const { impl } = fakeFetch({
      photon: {
        features: [
          photonFeature({ countrycode: 'BE', name: 'Liège', postcode: '4000', county: 'Liège' }),
          photonFeature({ countrycode: 'PL', name: 'Liège' }),
          photonFeature({ countrycode: 'CH', name: 'Liège' }),
        ],
      },
    });

    const cities = await searchCities('Liège', impl);

    expect(cities).toEqual([liege]);
  });

  it('une commune suisse vient de swisstopo, avec son canton et son numero OFS', async () => {
    const { impl, urls } = fakeFetch({ swisstopo: { results: [swiss('<b>Lausanne (VD)</b>', 'lausanne vd', '5586', 46.52, 6.63)] } });

    const cities = await searchCities('Lausanne', impl);

    expect(cities).toEqual([lausanne]);
    expect(urls.find((u) => u.includes('geo.admin.ch'))).toContain('origins=gg25');
  });

  it('une localite luxembourgeoise vient de geoportail.lu, sans son nom luxembourgeois', async () => {
    const { impl } = fakeFetch({
      lu: {
        features: [
          luLocality('Belvaux (Bieles)'),
          luLocality('Scheierhaff (Belvaux) (Scheierhaff)'),
          luLocality('Belvaux (Bieles)'),
        ],
      },
    });

    const cities = await searchCities('Belvaux', impl);

    expect(cities.map((c) => c.name)).toEqual(['Belvaux', 'Scheierhaff (Belvaux)']);
    // Le centre du rectangle de la localite.
    expect(cities[0].country).toBe('LU');
    expect(cities[0].latitude).toBeCloseTo(49.51);
    expect(cities[0].longitude).toBeCloseTo(5.93);
  });

  it('hors de France, ecarte les villes dont le nom ne contient pas la saisie', async () => {
    const { impl } = fakeFetch({
      photon: { features: [photonFeature({ countrycode: 'BE', name: 'Liège' })] },
      lu: { features: [luLocality('Linger (Lénger)')] },
      swisstopo: { results: [swiss('<b>Aeschi (SO)</b>', 'aeschi so', '2511')] },
    });

    const cities = await searchCities('liege', impl);

    expect(cities.map((c) => c.name)).toEqual(['Liège']);
  });

  it('le nom exact passe devant les communes francaises qui ne font que lui ressembler', async () => {
    const { impl } = fakeFetch({
      geo: [{ nom: 'Le Liège', code: '37128', codesPostaux: ['37460'], centre: { coordinates: [1.1, 47.2] } }],
      photon: { features: [photonFeature({ countrycode: 'BE', name: 'Liège' })] },
    });

    const cities = await searchCities('liege', impl);

    expect(cities.map((c) => c.name)).toEqual(['Liège', 'Le Liège']);
  });

  it('si des services ne repondent pas, les autres suffisent', async () => {
    const { impl } = fakeFetch({
      fail: ['geo', 'photon', 'lu'],
      swisstopo: { results: [swiss('<b>Lausanne (VD)</b>', 'lausanne vd', '5586')] },
    });

    expect((await searchCities('Lausanne', impl)).map((c) => c.name)).toEqual(['Lausanne']);
  });
});

describe('Adresses', () => {
  it('en France, la BAN filtre par code INSEE et se rabat sur les rues sans numero', async () => {
    const { impl, urls } = fakeFetch({
      ban: [
        { features: [] },
        { features: [{ properties: { name: 'Rue de la Paix', postcode: '54000', city: 'Nancy' }, geometry: { coordinates: [6.18, 48.69] } }] },
      ],
    });
    const nancy: CitySuggestion = { name: 'Nancy', country: 'FR', cityCode: '54395', postalCode: '54000', region: '', latitude: 48.69, longitude: 6.18 };

    const addresses = await searchAddresses('rue de la paix', nancy, impl);

    expect(addresses).toEqual([{ name: 'Rue de la Paix', postalCode: '54000', city: 'Nancy', latitude: 48.69, longitude: 6.18 }]);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('citycode=54395');
    expect(urls[1]).toContain('type=street');
  });

  it('en Suisse, garde les adresses de la commune choisie, avec leur code postal', async () => {
    const { impl, urls } = fakeFetch({
      swisstopo: {
        results: [
          swiss('Avenue de la Gare 5 <b>1003 Lausanne</b>', 'avenue de la gare 5 1003 lausanne 5586 lausanne ch vd', '884572_0', 46.517, 6.637),
          swiss('Avenue de la Gare 5 <b>1020 Renens VD</b>', 'avenue de la gare 5 1020 renens vd 5591 renens vd ch vd', '1_0'),
        ],
      },
    });

    const addresses = await searchAddresses('avenue de la gare 5', lausanne, impl);

    expect(addresses).toEqual([{ name: 'Avenue de la Gare 5', postalCode: '1003', city: 'Lausanne', latitude: 46.517, longitude: 6.637 }]);
    expect(urls[0]).toContain('origins=address');
    expect(decodeURIComponent(urls[0]).replace(/\+/g, ' ')).toContain('searchText=avenue de la gare 5 Lausanne');
  });

  it('au Luxembourg, met le numero devant la rue et garde la localite choisie', async () => {
    const { impl, urls } = fakeFetch({
      lu: {
        features: [
          luAddress('24, Rue de la Poste, L-4477 Belvaux', [5.931, 49.512]),
          luAddress('3, Rue de la Poste, L-4930 Bascharage'),
          luLocality('Belvaux (Bieles)'),
        ],
      },
    });

    const addresses = await searchAddresses('rue de la poste', belvaux, impl);

    expect(addresses).toEqual([{ name: '24 Rue de la Poste', postalCode: '4477', city: 'Belvaux', latitude: 49.512, longitude: 5.931 }]);
    expect(decodeURIComponent(urls[0])).toContain('layer=Adresse');
  });

  it('au Luxembourg, sans adresse dans la localite choisie, propose les autres', async () => {
    const { impl } = fakeFetch({ lu: { features: [luAddress('2, Boulevard Royal, L-2449 Luxembourg')] } });
    const gare: CitySuggestion = { ...belvaux, name: 'Luxembourg-Gare' };

    const addresses = await searchAddresses('boulevard royal', gare, impl);

    expect(addresses.map((a) => `${a.name}, ${a.postalCode} ${a.city}`)).toEqual(['2 Boulevard Royal, 2449 Luxembourg']);
  });

  it('en Belgique, cherche autour de la ville choisie et garde le code postal de l adresse', async () => {
    const { impl, urls } = fakeFetch({
      photon: {
        features: [
          photonFeature({ countrycode: 'BE', housenumber: '12', street: 'Rue Saint-Gilles', postcode: '4000' }),
          photonFeature({ countrycode: 'BE', housenumber: '12', street: 'Rue de Tilleur', postcode: '4420', city: 'Saint-Nicolas' }),
        ],
      },
    });

    const addresses = await searchAddresses('12 rue saint-gilles', liege, impl);

    expect(addresses.map((a) => `${a.name}, ${a.postalCode} ${a.city}`)).toEqual(['Rue Saint-Gilles 12, 4000 Liège', 'Rue de Tilleur 12, 4420 Saint-Nicolas']);
    expect(urls[0]).toContain('photon.komoot.io');
    expect(decodeURIComponent(urls[0])).toContain('bbox=5.45,50.56,5.69,50.72');
    expect(urls[0]).toContain('layer=house');
    expect(urls[0]).toContain('layer=street');
  });

  it('en Belgique, ecarte les adresses d un autre pays, les doublons et les lieux sans rue', async () => {
    const { impl } = fakeFetch({
      photon: {
        features: [
          photonFeature({ countrycode: 'BE', housenumber: '5', street: 'Rue Haute', postcode: '4000' }),
          photonFeature({ countrycode: 'BE', housenumber: '5', street: 'Rue Haute', postcode: '4000', name: 'Boulangerie' }),
          photonFeature({ countrycode: 'NL', housenumber: '5', street: 'Hoogstraat', postcode: '6211' }),
          photonFeature({ countrycode: 'BE', type: 'house', name: 'Gare des Guillemins' }),
          photonFeature({ countrycode: 'BE', type: 'street', name: 'Rue Basse', postcode: '4020' }),
        ],
      },
    });

    const addresses = await searchAddresses('rue', liege, impl);

    expect(addresses.map((a) => a.name)).toEqual(['Rue Haute 5', 'Rue Basse']);
  });

  it('en Belgique, reprend le code postal et la commune de la ville quand l adresse ne les a pas', async () => {
    const { impl } = fakeFetch({ photon: { features: [photonFeature({ countrycode: 'BE', type: 'street', name: 'Rue Basse' })] } });

    const [address] = await searchAddresses('rue basse', liege, impl);

    expect(address).toMatchObject({ postalCode: '4000', city: 'Liège' });
  });
});

describe('Ordre du numero et de la rue', () => {
  it('suit l usage de chaque pays', () => {
    expect(formatStreet('FR', 'rue de la Paix', '12')).toBe('12 rue de la Paix');
    expect(formatStreet('LU', "rue de l'Alzette", '122')).toBe("122 rue de l'Alzette");
    expect(formatStreet('BE', 'Rue Saint-Gilles', '12')).toBe('Rue Saint-Gilles 12');
    expect(formatStreet('CH', 'Bahnhofstrasse', '10')).toBe('Bahnhofstrasse 10');
    expect(formatStreet('CH', 'Bahnhofstrasse')).toBe('Bahnhofstrasse');
  });
});
