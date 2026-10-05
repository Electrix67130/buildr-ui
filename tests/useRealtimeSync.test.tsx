/**
 * Synchronisation en temps reel.
 *
 * La WebSocket fait apparaitre les messages et les photos des collegues sans
 * tirer pour rafraichir. Elle porte aussi trois fermetures qui ne sont pas des
 * pannes : compte connecte sur un autre telephone (4001), desactive (4002),
 * supprime (4003). Les prendre pour une coupure reseau ferait reconnecter
 * l'app en boucle sur une session morte ; prendre une vraie coupure pour l'une
 * d'elles laisserait l'ouvrier sans mises a jour jusqu'au prochain demarrage.
 *
 * `WebSocket` est remplacee par une fausse, pilotee par le test.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { creerQueryClient } from './helpers/render';

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
jest.mock('@/api/client', () => ({ getAccessToken: () => mockGetAccessToken() }));

class FausseWebSocket {
  static instances: FausseWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn((code: number) => this.onclose?.({ code }));

  constructor(url: string) {
    this.url = url;
    FausseWebSocket.instances.push(this);
  }

  /** Le serveur ferme la connexion avec ce code. */
  fermer(code: number): void {
    this.onclose?.({ code });
  }

  recevoir(evenement: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(evenement) });
  }
}

const derniere = () => FausseWebSocket.instances[FausseWebSocket.instances.length - 1];

/** Laisse `connect` lire le jeton (asynchrone) et ouvrir la socket. */
async function laisserConnecter(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let queryClient: QueryClient;
const rappels = {
  onSessionReplaced: jest.fn(),
  onAccountDisabled: jest.fn(),
  onAccountDeleted: jest.fn(),
};

function monter(enabled = true) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRealtimeSync({ enabled, ...rappels }), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  FausseWebSocket.instances = [];
  (global as unknown as { WebSocket: unknown }).WebSocket = FausseWebSocket;
  mockGetAccessToken.mockResolvedValue('jeton-1');
  queryClient = creerQueryClient();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Connexion', () => {
  it('ouvre la socket avec le jeton et la cle d API', async () => {
    monter();
    await laisserConnecter();

    expect(FausseWebSocket.instances).toHaveLength(1);
    expect(derniere().url).toMatch(/^ws.*\/ws\?token=jeton-1&api_key=/);
  });

  it('ne se connecte pas quand elle est desactivee, ni sans jeton', async () => {
    monter(false);
    await laisserConnecter();
    expect(FausseWebSocket.instances).toHaveLength(0);

    mockGetAccessToken.mockResolvedValue(null);
    monter(true);
    await laisserConnecter();
    expect(FausseWebSocket.instances).toHaveLength(0);
  });

  it('ferme proprement au demontage, sans reconnexion', async () => {
    const { unmount } = monter();
    await laisserConnecter();
    const ws = derniere();

    unmount();
    act(() => jest.advanceTimersByTime(60_000));

    expect(ws.close).toHaveBeenCalledWith(1000, 'unmount');
    expect(FausseWebSocket.instances).toHaveLength(1);
  });
});

describe('Fermetures signifiantes', () => {
  it.each([
    [4001, 'onSessionReplaced'],
    [4002, 'onAccountDisabled'],
    [4003, 'onAccountDeleted'],
  ] as const)('le code %i appelle %s et ne reconnecte pas', async (code, rappel) => {
    monter();
    await laisserConnecter();

    act(() => derniere().fermer(code));
    act(() => jest.advanceTimersByTime(60_000));
    await laisserConnecter();

    expect(rappels[rappel]).toHaveBeenCalledTimes(1);
    for (const [nom, fn] of Object.entries(rappels)) {
      if (nom !== rappel) expect(fn).not.toHaveBeenCalled();
    }
    expect(FausseWebSocket.instances).toHaveLength(1);
  });
});

describe('Coupure ordinaire', () => {
  it('reconnecte apres un delai, sans prevenir de deconnexion', async () => {
    monter();
    await laisserConnecter();

    act(() => derniere().fermer(1006));
    act(() => jest.advanceTimersByTime(999));
    expect(FausseWebSocket.instances).toHaveLength(1);

    act(() => jest.advanceTimersByTime(1));
    await laisserConnecter();

    expect(FausseWebSocket.instances).toHaveLength(2);
    expect(rappels.onSessionReplaced).not.toHaveBeenCalled();
    expect(rappels.onAccountDisabled).not.toHaveBeenCalled();
    expect(rappels.onAccountDeleted).not.toHaveBeenCalled();
  });

  it('espace les tentatives successives, puis repart du debut une fois connectee', async () => {
    monter();
    await laisserConnecter();

    // Premier echec : 1 s.
    act(() => derniere().fermer(1006));
    act(() => jest.advanceTimersByTime(1000));
    await laisserConnecter();
    expect(FausseWebSocket.instances).toHaveLength(2);

    // Second echec d'affilee : 2 s, pas 1.
    act(() => derniere().fermer(1006));
    act(() => jest.advanceTimersByTime(1000));
    await laisserConnecter();
    expect(FausseWebSocket.instances).toHaveLength(2);
    act(() => jest.advanceTimersByTime(1000));
    await laisserConnecter();
    expect(FausseWebSocket.instances).toHaveLength(3);

    // Connexion reussie : le compteur repart de zero.
    act(() => derniere().onopen?.());
    act(() => derniere().fermer(1006));
    act(() => jest.advanceTimersByTime(1000));
    await laisserConnecter();
    expect(FausseWebSocket.instances).toHaveLength(4);
  });
});

describe('Evenements', () => {
  it('un nouveau message invalide le fil et les pastilles de non-lus du chantier', async () => {
    const invalider = jest.spyOn(queryClient, 'invalidateQueries');
    monter();
    await laisserConnecter();

    act(() => derniere().recevoir({ type: 'comment.created', chantier_id: 'c-1' }));

    expect(invalider).toHaveBeenCalledWith({ queryKey: ['comments', 'c-1'] });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['chantier-views', 'unread', 'c-1'] });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['chantier-views', 'unread-summary'] });
  });

  it('une nouvelle photo invalide la galerie du chantier', async () => {
    const invalider = jest.spyOn(queryClient, 'invalidateQueries');
    monter();
    await laisserConnecter();

    act(() => derniere().recevoir({ type: 'photo.created', chantier_id: 'c-1' }));

    expect(invalider).toHaveBeenCalledWith({ queryKey: ['photos', 'c-1'] });
  });

  it('un changement de role relit tout', async () => {
    const invalider = jest.spyOn(queryClient, 'invalidateQueries');
    monter();
    await laisserConnecter();

    act(() => derniere().recevoir({ type: 'membership.updated' }));

    expect(invalider).toHaveBeenCalledWith();
  });

  it('ignore un message illisible sans couper la connexion', async () => {
    const invalider = jest.spyOn(queryClient, 'invalidateQueries');
    monter();
    await laisserConnecter();

    act(() => derniere().onmessage?.({ data: 'pas du json' }));

    expect(invalider).not.toHaveBeenCalled();
    expect(derniere().close).not.toHaveBeenCalled();
  });
});

describe('Comportements suspects connus', () => {
  // Voir docs/TESTING.md : `it.failing` decrit l'attendu et echoue aujourd'hui.
  it("n'ouvre aucune socket si le composant est demonte pendant la lecture du jeton", async () => {
    // `connect` verifie l'annulation avant d'attendre le jeton, pas apres. Une
    // deconnexion (enabled qui repasse a false) survenue pendant cette attente
    // laisse ouverte une socket que plus personne ne fermera.
    let donnerJeton!: (t: string) => void;
    mockGetAccessToken.mockImplementation(() => new Promise((resolve) => { donnerJeton = resolve; }));
    const { unmount } = monter();

    unmount();
    donnerJeton('jeton-1');
    await laisserConnecter();

    expect(FausseWebSocket.instances).toHaveLength(0);
  });
});
