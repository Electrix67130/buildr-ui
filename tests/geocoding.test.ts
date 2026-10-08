/**
 * Recherche de villes et d'adresses de chantier.
 *
 * Les CGU ouvrent Buildr a la France, la Belgique, le Luxembourg et la Suisse,
 * mais la recherche ne connaissait que la France : un chantier a Liege ou a
 * Lausanne ne pouvait pas avoir d'adresse. La France garde les API de l'Etat,
 * les trois autres pays passent par Photon (OpenStreetMap).
 */
import { searchCities, searchAddresses, formatStreet, CitySuggestion } from '@/utils/geocoding';

type Routes = { geo?: unknown; ban?: unknown[]; photon?: unknown; fail?: 'geo' | 'photon' };

/** Faux fetch : repond selon le service appele et garde les URL demandees. */
function fakeFetch(routes: Routes) {
  const urls: string[] = [];
  let ban = 0;
  const impl = async (url: string) => {
    urls.push(url);
    if (url.includes('geo.api.gouv.fr')) {
      if (routes.fail === 'geo') throw new Error('hors ligne');
      return { json: async () => routes.geo ?? [] };
    }
    if (url.includes('api-adresse')) {
      const body = routes.ban?.[ban] ?? { features: [] };
      ban += 1;
      return { json: async () => body };
    }
    if (routes.fail === 'photon') throw new Error('hors ligne');
    return { json: async () => routes.photon ?? { features: [] } };
  };
  return { impl, urls };
}

function photonFeature(properties: Record<string, string>, coords: [number, number] = [5.57, 50.64]) {
  return { properties, geometry: { coordinates: coords } };
}

const liege: CitySuggestion = {
  name: 'Liège', country: 'BE', postalCode: '4000', region: 'Liège', latitude: 50.64, longitude: 5.57,
};

describe('Villes', () => {
  it('trouve une ville belge, luxembourgeoise ou suisse, et ignore les autres pays', async () => {
    const { impl } = fakeFetch({
      photon: {
        features: [
          photonFeature({ countrycode: 'BE', name: 'Liège', postcode: '4000', county: 'Liège' }),
          photonFeature({ countrycode: 'PL', name: 'Ligi' }),
          photonFeature({ countrycode: 'CH', name: 'Lausanne', state: 'Vaud' }, [6.63, 46.52]),
        ],
      },
    });

    const cities = await searchCities('Liège', impl);

    expect(cities.map((c) => `${c.country} ${c.name}`)).toEqual(['BE Liège', 'CH Lausanne']);
    expect(cities[1]).toMatchObject({ postalCode: '', region: 'Vaud', latitude: 46.52, longitude: 6.63 });
  });

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

  it('le nom exact passe devant les communes francaises qui ne font que lui ressembler', async () => {
    const { impl } = fakeFetch({
      geo: [{ nom: 'Le Liège', code: '37128', codesPostaux: ['37460'], centre: { coordinates: [1.1, 47.2] } }],
      photon: { features: [photonFeature({ countrycode: 'BE', name: 'Liège' })] },
    });

    const cities = await searchCities('liege', impl);

    expect(cities.map((c) => c.name)).toEqual(['Liège', 'Le Liège']);
  });

  it('si un service ne repond pas, l autre suffit', async () => {
    const photonDown = fakeFetch({
      fail: 'photon',
      geo: [{ nom: 'Épinal', code: '88160', codesPostaux: ['88000'], centre: { coordinates: [6.45, 48.17] } }],
    });
    expect((await searchCities('Epinal', photonDown.impl)).map((c) => c.name)).toEqual(['Épinal']);

    const geoDown = fakeFetch({ fail: 'geo', photon: { features: [photonFeature({ countrycode: 'LU', name: 'Esch-sur-Alzette' })] } });
    expect((await searchCities('Esch', geoDown.impl)).map((c) => c.name)).toEqual(['Esch-sur-Alzette']);
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

  it('hors de France, cherche autour de la ville choisie et garde le code postal de l adresse', async () => {
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

  it('ecarte les adresses d un autre pays, les doublons et les lieux sans rue', async () => {
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

  it('reprend le code postal et la commune de la ville quand l adresse ne les a pas', async () => {
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
