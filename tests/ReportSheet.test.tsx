/**
 * Fenetre de signalement.
 *
 * Un signalement sans motif ne dit rien a l'administrateur qui le recoit : il
 * ne sait ni quoi chercher ni quelle suite donner. La fenetre doit donc
 * refuser de partir tant qu'aucun motif n'est choisi, puis transmettre a
 * l'API exactement ce qui a ete saisi, rattache au bon contenu.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import ReportSheet from '@/components/ReportSheet';
import { rendre } from './helpers/render';

const mockApiFetch = jest.fn();
jest.mock('@/api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

const CIBLE = { type: 'comment' as const, id: 'comment-42', label: 'Marc Dupont : on coule la dalle demain' };

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({ id: 'report-1' });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('ReportSheet', () => {
  it("rappelle le contenu signale en haut de la fenetre", async () => {
    await rendre(<ReportSheet target={CIBLE} onClose={jest.fn()} />);

    expect(await screen.findByText(CIBLE.label)).toBeTruthy();
  });

  it("n'envoie rien tant qu'aucun motif n'est choisi", async () => {
    await rendre(<ReportSheet target={CIBLE} onClose={jest.fn()} />);

    const envoyer = await screen.findByRole('button', { name: /Envoyer le signalement/ });
    expect(envoyer).toBeDisabled();
    fireEvent.press(envoyer);

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('envoie le motif, le commentaire et la cible, puis se ferme', async () => {
    const onClose = jest.fn();
    await rendre(<ReportSheet target={CIBLE} onClose={onClose} />);

    fireEvent.press(await screen.findByRole('radio', { name: /Harcèlement/ }));
    fireEvent.changeText(screen.getByPlaceholderText('Expliquez ce qui pose problème…'), '  propos insultants  ');
    fireEvent.press(screen.getByRole('button', { name: /Envoyer le signalement/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith('/reports', {
      method: 'POST',
      body: { target_type: 'comment', target_id: 'comment-42', reason: 'harassment', comment: 'propos insultants' },
    });
    expect(Alert.alert).toHaveBeenCalledWith('Signalement envoyé', expect.any(String));
  });

  it("n'envoie pas de commentaire fait seulement d'espaces", async () => {
    await rendre(<ReportSheet target={CIBLE} onClose={jest.fn()} />);

    fireEvent.press(await screen.findByRole('radio', { name: /Autre/ }));
    fireEvent.changeText(screen.getByPlaceholderText('Expliquez ce qui pose problème…'), '   ');
    fireEvent.press(screen.getByRole('button', { name: /Envoyer le signalement/ }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(mockApiFetch.mock.calls[0][1].body.comment).toBeUndefined();
  });

  it("reste ouverte et previent quand l'envoi echoue", async () => {
    mockApiFetch.mockRejectedValue(new Error('Serveur indisponible'));
    const onClose = jest.fn();
    await rendre(<ReportSheet target={CIBLE} onClose={onClose} />);

    fireEvent.press(await screen.findByRole('radio', { name: /Hors sujet/ }));
    fireEvent.press(screen.getByRole('button', { name: /Envoyer le signalement/ }));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), 'Serveur indisponible'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
