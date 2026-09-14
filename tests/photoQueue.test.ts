/**
 * File d'attente des photos hors ligne.
 *
 * C'est le seul endroit de l'app ou une donnee existe uniquement sur le
 * telephone. Une erreur ici ne provoque pas de plantage : elle perd le travail
 * d'un ouvrier, en silence, et personne ne s'en apercoit avant de chercher une
 * photo qui n'a jamais ete prise.
 */

// Les doublures sont declarees ici, hors des fabriques, et non a l'interieur :
// `jest.isolateModules` rejoue chaque fabrique, ce qui creerait une nouvelle
// doublure par rechargement. Le test observerait alors une instance pendant que
// le module en utiliserait une autre — et le stockage ne survivrait pas au
// « redemarrage » qu'on cherche justement a simuler.
// React Query est double lui aussi : le module recharge en recevrait sinon sa
// propre copie, et l'etat reseau pilote par le test ne serait pas celui que la
// file consulte. La file n'utilise que `onlineManager`.
const mockReseau = { enLigne: true };
const mockAbonnes = new Set<(online: boolean) => void>();
const mockOnlineManager = {
  isOnline: () => mockReseau.enLigne,
  subscribe: (cb: (online: boolean) => void) => {
    mockAbonnes.add(cb);
    return () => mockAbonnes.delete(cb);
  },
};
jest.mock('@tanstack/react-query', () => ({ onlineManager: mockOnlineManager }));

/** Bascule l'etat reseau vu par la file. */
function setOnline(enLigne: boolean): void {
  mockReseau.enLigne = enLigne;
  for (const cb of mockAbonnes) cb(enLigne);
}

const mockAsyncStorage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const mockFichiersSupprimes: string[] = [];
const mockCopyAsync = jest.fn(async () => undefined);
const mockDeleteAsync = jest.fn(async (uri: string) => {
  mockFichiersSupprimes.push(uri);
});
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: async () => ({ exists: true }),
  makeDirectoryAsync: async () => undefined,
  copyAsync: mockCopyAsync,
  deleteAsync: mockDeleteAsync,
}));

jest.mock('@/utils/optimizeImage', () => ({
  optimizeImage: jest.fn(async (uri: string) => ({ uri, mimeType: 'image/jpeg' })),
}));

const mockUploadFile = jest.fn();
jest.mock('@/api/upload', () => ({ uploadFile: (...args: unknown[]) => mockUploadFile(...args) }));

const mockApiFetch = jest.fn();
jest.mock('@/api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

/** Recharge le module : sa file vit en memoire, chaque test la veut vierge. */
function chargerFile(): typeof import('@/utils/photoQueue') {
  let mod!: typeof import('@/utils/photoQueue');
  jest.isolateModules(() => {
    mod = require('@/utils/photoQueue');
  });
  return mod;
}

const PHOTO = { uri: 'file:///cache/photo.jpg', width: 4000, height: 3000 };

/**
 * Laisse se terminer le traitement lance en arriere-plan.
 *
 * `enqueuePhoto` et `retryPhoto` declenchent l'envoi sans l'attendre — c'est
 * voulu, l'interface ne doit pas se figer. Un `await processQueue()` ne suffit
 * pas a l'observer : il ressort aussitot, le traitement concurrent etant deja
 * en cours.
 */
async function laisserFinir(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockFichiersSupprimes.length = 0;
  await mockAsyncStorage.clear();
  mockUploadFile.mockResolvedValue({ url: 'https://api/files/a.jpg', thumbnail_url: 'https://api/files/a-thumb.jpg', file_size: 1234, mime_type: 'image/jpeg' });
  mockApiFetch.mockResolvedValue({ id: 'photo-1' });
  setOnline(true);
});

describe('Mise en file', () => {
  it('copie la photo hors du cache temporaire du systeme', async () => {
    // Le fichier rendu par l'appareil photo vit dans un cache que le systeme
    // peut vider a tout moment : l'y laisser, c'est perdre la photo.
    setOnline(false);
    const { enqueuePhoto, getSnapshot } = chargerFile();

    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    expect(mockCopyAsync).toHaveBeenCalled();
    expect(getSnapshot()[0].localUri).toContain('file:///documents/photo-queue/');
    expect(getSnapshot()[0].localUri).not.toBe(PHOTO.uri);
  });

  it("retient l'heure de la prise de vue, pas celle de l'envoi", async () => {
    setOnline(false);
    const { enqueuePhoto, getSnapshot } = chargerFile();

    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO, takenAt: '2026-09-14T08:30:00.000Z' });

    expect(getSnapshot()[0].takenAt).toBe('2026-09-14T08:30:00.000Z');
  });

  it('survit au redemarrage de l app', async () => {
    // Toute la raison d'etre de la file : le telephone peut s'eteindre entre la
    // prise de vue et le retour du reseau.
    setOnline(false);
    const premiere = chargerFile();
    await premiere.enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    // Rechargement du module : la file en memoire est perdue, seul le stockage
    // subsiste. Si l'entree n'avait pas ete ecrite sur le telephone, plus rien
    // ne partirait ici.
    const apresRedemarrage = chargerFile();
    setOnline(true);
    await apresRedemarrage.processQueue();

    expect(mockApiFetch).toHaveBeenCalledWith('/photos', expect.objectContaining({
      body: expect.objectContaining({ chantier_id: 'c-1' }),
    }));
    expect(apresRedemarrage.getSnapshot()).toHaveLength(0);
  });

  it('previent ses abonnes a chaque changement', async () => {
    setOnline(false);
    const { enqueuePhoto, subscribe } = chargerFile();
    const abonne = jest.fn();
    subscribe(abonne);

    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    expect(abonne).toHaveBeenCalled();
  });
});

describe('Envoi', () => {
  it('ne tente rien hors ligne', async () => {
    setOnline(false);
    const { enqueuePhoto, processQueue, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    await processQueue();

    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(getSnapshot()).toHaveLength(1);
  });

  it('envoie la photo au retour du reseau, avec son heure de prise de vue', async () => {
    setOnline(false);
    const { enqueuePhoto, processQueue, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO, takenAt: '2026-09-14T08:30:00.000Z' });

    setOnline(true);
    await processQueue();

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/photos', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        chantier_id: 'c-1',
        url: 'https://api/files/a.jpg',
        taken_at: '2026-09-14T08:30:00.000Z',
      }),
    }));
    expect(getSnapshot()).toHaveLength(0);
  });

  it('supprime le fichier local une fois la photo transmise', async () => {
    // Sinon le telephone d'un ouvrier se remplit de photos deja envoyees.
    setOnline(false);
    const { enqueuePhoto, processQueue } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    setOnline(true);
    await processQueue();

    expect(mockFichiersSupprimes).toHaveLength(1);
    expect(mockFichiersSupprimes[0]).toContain('photo-queue/');
  });

  it('respecte l ordre des prises de vue', async () => {
    setOnline(false);
    const { enqueuePhoto, processQueue } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO, takenAt: '2026-09-14T08:00:00.000Z' });
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO, takenAt: '2026-09-14T09:00:00.000Z' });

    setOnline(true);
    await processQueue();

    const heures = mockApiFetch.mock.calls.map((c) => (c[1] as { body: { taken_at: string } }).body.taken_at);
    expect(heures).toEqual(['2026-09-14T08:00:00.000Z', '2026-09-14T09:00:00.000Z']);
  });

  it('garde la photo quand l envoi echoue', async () => {
    setOnline(false);
    const { enqueuePhoto, processQueue, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    mockApiFetch.mockRejectedValue(new Error('coupure'));
    setOnline(true);
    await processQueue();

    expect(getSnapshot()).toHaveLength(1);
    expect(getSnapshot()[0].attempts).toBe(1);
    expect(getSnapshot()[0].status).toBe('pending');
    expect(mockFichiersSupprimes).toHaveLength(0);
  });

  it('cesse de retenter apres cinq echecs, et le signale', async () => {
    // Une photo qu'un serveur refuse toujours — trop lourde, type invalide —
    // serait sinon rejouee sans fin a chaque retour de reseau.
    setOnline(false);
    const { enqueuePhoto, processQueue, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    mockApiFetch.mockRejectedValue(new Error('refus'));
    setOnline(true);
    for (let i = 0; i < 5; i++) await processQueue();

    expect(getSnapshot()[0].status).toBe('error');
    expect(getSnapshot()[0].attempts).toBe(5);

    // Et une entree en erreur n'est plus retentee d'elle-meme.
    const avant = mockApiFetch.mock.calls.length;
    await processQueue();
    expect(mockApiFetch.mock.calls).toHaveLength(avant);
  });

  it('une photo en echec ne bloque pas les suivantes', async () => {
    setOnline(false);
    const { enqueuePhoto, processQueue, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO, takenAt: 'A' });
    await enqueuePhoto({ chantierId: 'c-2', photo: PHOTO, takenAt: 'B' });

    mockApiFetch.mockRejectedValueOnce(new Error('coupure'));
    setOnline(true);
    await processQueue();

    expect(getSnapshot()).toHaveLength(1);
    expect(getSnapshot()[0].takenAt).toBe('A');
  });
});

describe('Reprise en main', () => {
  it('permet de relancer une photo en echec', async () => {
    setOnline(false);
    const { enqueuePhoto, processQueue, retryPhoto, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    mockApiFetch.mockRejectedValue(new Error('refus'));
    setOnline(true);
    for (let i = 0; i < 5; i++) await processQueue();
    expect(getSnapshot()[0].status).toBe('error');

    mockApiFetch.mockResolvedValue({ id: 'photo-1' });
    await retryPhoto(getSnapshot()[0].id);
    await laisserFinir();

    expect(getSnapshot()).toHaveLength(0);
  });

  it('permet d abandonner une photo, fichier compris', async () => {
    setOnline(false);
    const { enqueuePhoto, discardPhoto, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });

    await discardPhoto(getSnapshot()[0].id);

    expect(getSnapshot()).toHaveLength(0);
    expect(mockFichiersSupprimes).toHaveLength(1);
  });

  it('ne rend a chaque chantier que ses propres photos', async () => {
    setOnline(false);
    const { enqueuePhoto, getSnapshot } = chargerFile();
    await enqueuePhoto({ chantierId: 'c-1', photo: PHOTO });
    await enqueuePhoto({ chantierId: 'c-2', photo: PHOTO });

    expect(getSnapshot().filter((e) => e.chantierId === 'c-1')).toHaveLength(1);
  });
});
