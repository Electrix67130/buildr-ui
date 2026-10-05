/**
 * Renouvellement de session du client API.
 *
 * Le jeton d'acces expire souvent ; le client le renouvelle en silence puis
 * rejoue la requete. Tout le danger est dans la lecture de l'echec : effacer
 * les jetons sur un 502 — l'API en plein redeploiement — deconnectait tous les
 * ouvriers a chaque mise en ligne, sur le chantier, souvent sans leur mot de
 * passe sous la main. Seul un 401 du renouvellement signifie une session finie.
 *
 * `fetch` est double ; le stockage est la doublure memoire d'AsyncStorage
 * (voir tests/setup.ts), lue directement pour verifier les jetons.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, ApiError, setTokens } from '@/api/client';

type Reponse = { status: number; body?: unknown };

function reponse({ status, body }: Reponse): Response {
  const texte = body === undefined ? '' : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => texte,
    json: async () => body,
  } as Response;
}

const mockFetch = jest.fn<Promise<Response>, [string, RequestInit]>();

/** Programme les reponses successives de `fetch`, dans l'ordre des appels. */
function repondre(...reponses: Reponse[]): void {
  for (const r of reponses) mockFetch.mockResolvedValueOnce(reponse(r));
}

function entete(appel: number, nom: string): string | undefined {
  return (mockFetch.mock.calls[appel][1].headers as Record<string, string>)[nom];
}

beforeEach(async () => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  await AsyncStorage.clear();
  await setTokens('acces-perime', 'renouvellement-1');
});

describe('Requete ordinaire', () => {
  it('envoie le jeton d acces et la cle d API', async () => {
    repondre({ status: 200, body: { id: 'c-1' } });

    await expect(apiFetch('/chantiers/c-1')).resolves.toEqual({ id: 'c-1' });
    expect(entete(0, 'Authorization')).toBe('Bearer acces-perime');
    expect(entete(0, 'x-api-key')).toBeDefined();
  });

  it('remonte l erreur de l API avec son code et son message', async () => {
    repondre({ status: 403, body: { statusCode: 403, error: 'Forbidden', message: 'Acces refuse' } });

    await expect(apiFetch('/chantiers/c-1')).rejects.toMatchObject({ statusCode: 403, message: 'Acces refuse' });
  });
});

describe('Jeton expire', () => {
  it('renouvelle le jeton puis rejoue la requete avec le nouveau', async () => {
    repondre(
      { status: 401, body: { message: 'expired' } },
      { status: 200, body: { access_token: 'acces-neuf', refresh_token: 'renouvellement-2' } },
      { status: 200, body: { id: 'c-1' } },
    );

    await expect(apiFetch('/chantiers/c-1')).resolves.toEqual({ id: 'c-1' });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body as string)).toEqual({ refresh_token: 'renouvellement-1' });
    expect(mockFetch.mock.calls[2][0]).toMatch(/\/chantiers\/c-1$/);
    expect(entete(2, 'Authorization')).toBe('Bearer acces-neuf');
    expect(await AsyncStorage.getItem('access_token')).toBe('acces-neuf');
    expect(await AsyncStorage.getItem('refresh_token')).toBe('renouvellement-2');
  });

  it('rejoue une ecriture avec le meme corps', async () => {
    repondre(
      { status: 401 },
      { status: 200, body: { access_token: 'acces-neuf', refresh_token: 'renouvellement-2' } },
      { status: 201, body: { id: 'm-1' } },
    );

    await apiFetch('/comments', { method: 'POST', body: { content: 'Bonjour' } });

    expect(mockFetch.mock.calls[2][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ content: 'Bonjour' }) });
  });

  it('un seul renouvellement pour plusieurs requetes refusees en meme temps', async () => {
    // Deux renouvellements concurrents : le second presenterait un jeton
    // deja consomme par le premier, et deconnecterait l'utilisateur.
    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return reponse({ status: 200, body: { access_token: 'acces-neuf', refresh_token: 'renouvellement-2' } });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return reponse(auth === 'Bearer acces-neuf' ? { status: 200, body: { ok: true } } : { status: 401 });
    });

    await Promise.all([apiFetch('/a'), apiFetch('/b')]);

    expect(mockFetch.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });
});

describe('Echec du renouvellement', () => {
  it('un 502 au renouvellement ne vide pas les jetons', async () => {
    repondre({ status: 401 }, { status: 502 });

    const erreur = await apiFetch('/chantiers').catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).statusCode).toBe(502);
    expect(await AsyncStorage.getItem('access_token')).toBe('acces-perime');
    expect(await AsyncStorage.getItem('refresh_token')).toBe('renouvellement-1');
  });

  it('une API injoignable au renouvellement ne vide pas les jetons', async () => {
    repondre({ status: 401 });
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(apiFetch('/chantiers')).rejects.toThrow('Network request failed');
    expect(await AsyncStorage.getItem('refresh_token')).toBe('renouvellement-1');
  });

  it('un 401 au renouvellement vide les jetons et signale une session expiree', async () => {
    repondre({ status: 401 }, { status: 401 });

    await expect(apiFetch('/chantiers')).rejects.toMatchObject({ statusCode: 401, message: 'Session expired' });
    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
  });

  it('sans jeton de renouvellement, ne sollicite pas l API et signale une session expiree', async () => {
    await AsyncStorage.removeItem('refresh_token');
    repondre({ status: 401 });

    await expect(apiFetch('/chantiers')).rejects.toMatchObject({ statusCode: 401, message: 'Session expired' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('ne tente aucun renouvellement sur une requete sans authentification', async () => {
    repondre({ status: 401, body: { statusCode: 401, error: 'Unauthorized', message: 'Mot de passe incorrect' } });

    await expect(apiFetch('/auth/login', { method: 'POST', auth: false, body: {} })).rejects.toMatchObject({
      message: 'Mot de passe incorrect',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
