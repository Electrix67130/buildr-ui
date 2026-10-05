/**
 * Menu d'un message du fil de chantier.
 *
 * Un appui long ouvre les actions possibles sur un message. Proposer
 * « Modifier » ou « Supprimer » sur le message d'un collegue laisserait croire
 * qu'on peut effacer ses propos ; proposer « Signaler » ou « Bloquer » sur le
 * sien n'a aucun sens. Le menu doit donc dependre de l'auteur, et une reponse
 * doit partir rattachee au message cite.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import CommentThread from '@/components/CommentThread';
import { rendre } from './helpers/render';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const mockApiFetch = jest.fn();
jest.mock('@/api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

const MOI = { id: 'user-moi', first_name: 'Julie', last_name: 'Martin' };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: MOI }) }));

function message(id: string, auteur: { id: string; first_name: string; last_name: string }, content: string) {
  return {
    id,
    chantier_id: 'chantier-1',
    step_id: null,
    author_id: auteur.id,
    first_name: auteur.first_name,
    last_name: auteur.last_name,
    content,
    reactions: [],
    created_at: '2026-10-04T08:00:00.000Z',
    updated_at: '2026-10-04T08:00:00.000Z',
  };
}

const COLLEGUE = { id: 'user-marc', first_name: 'Marc', last_name: 'Dupont' };
const FIL = [
  message('c-1', COLLEGUE, 'On coule la dalle demain'),
  message('c-2', MOI, 'Je commande le beton'),
];

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (endpoint: string, options?: { method?: string }) => {
    if (endpoint.startsWith('/comments?')) return { data: FIL, total: FIL.length };
    if (options?.method === 'POST') return { id: 'c-3' };
    return {};
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

async function ouvrirMenu(contenu: string): Promise<void> {
  fireEvent(await screen.findByText(contenu), 'longPress');
}

describe('CommentThread', () => {
  it("propose Signaler et Bloquer sur le message d'autrui, ni Modifier ni Supprimer", async () => {
    await rendre(<CommentThread chantierId="chantier-1" />);
    await ouvrirMenu('On coule la dalle demain');

    expect(await screen.findByText('Signaler')).toBeTruthy();
    expect(screen.getByText('Bloquer Marc Dupont')).toBeTruthy();
    expect(screen.queryByText('Modifier')).toBeNull();
    expect(screen.queryByText('Supprimer')).toBeNull();
  });

  it('propose Modifier et Supprimer sur son propre message, ni Signaler ni Bloquer', async () => {
    await rendre(<CommentThread chantierId="chantier-1" />);
    await ouvrirMenu('Je commande le beton');

    expect(await screen.findByText('Modifier')).toBeTruthy();
    expect(screen.getByText('Supprimer')).toBeTruthy();
    expect(screen.queryByText('Signaler')).toBeNull();
    expect(screen.queryByText(/^Bloquer/)).toBeNull();
  });

  it('demande confirmation avant de bloquer, et ne bloque qu apres', async () => {
    await rendre(<CommentThread chantierId="chantier-1" />);
    await ouvrirMenu('On coule la dalle demain');
    fireEvent.press(await screen.findByText('Bloquer Marc Dupont'));

    expect(Alert.alert).toHaveBeenCalledWith('Bloquer Marc Dupont ?', expect.any(String), expect.any(Array));
    expect(mockApiFetch).not.toHaveBeenCalledWith('/blocks', expect.anything());

    const boutons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
    boutons.find((b) => b.text === 'Bloquer')!.onPress!();

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/blocks', { method: 'POST', body: { user_id: 'user-marc' } }),
    );
  });

  it('une reponse part rattachee au message cite', async () => {
    await rendre(<CommentThread chantierId="chantier-1" />);
    await ouvrirMenu('On coule la dalle demain');
    fireEvent.press(await screen.findByText('Répondre'));

    expect(await screen.findByText('Réponse à Marc Dupont')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Écrire un commentaire'), 'Bien recu');
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/comments', {
        method: 'POST',
        body: { chantier_id: 'chantier-1', step_id: null, content: 'Bien recu', reply_to_id: 'c-1' },
      }),
    );
  });
});
