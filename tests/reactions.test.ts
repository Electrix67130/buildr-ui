/**
 * Reaction optimiste sous un message.
 *
 * La pastille change sous le doigt avant la reponse du serveur. Si le calcul
 * local se trompe, le compteur saute d'une valeur a l'autre a l'arrivee de la
 * reponse, ou une reaction d'autrui disparait le temps d'un aller-retour.
 */
jest.mock('@/api/client', () => ({ apiFetch: jest.fn() }));

import { toggleLocally } from '@/api/hooks/useComments';

describe('toggleLocally', () => {
  it('ajoute une reaction absente, comptee a un et marquee comme mienne', () => {
    expect(toggleLocally(undefined, '👍')).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    expect(toggleLocally([{ emoji: '❤️', count: 2, mine: false }], '👍')).toEqual([
      { emoji: '❤️', count: 2, mine: false },
      { emoji: '👍', count: 1, mine: true },
    ]);
  });

  it('retire la pastille quand j etais seul a reagir', () => {
    expect(toggleLocally([{ emoji: '👍', count: 1, mine: true }, { emoji: '🔥', count: 1, mine: false }], '👍')).toEqual([
      { emoji: '🔥', count: 1, mine: false },
    ]);
  });

  it('decremente sans retirer quand d autres ont reagi aussi', () => {
    expect(toggleLocally([{ emoji: '👍', count: 3, mine: true }], '👍')).toEqual([{ emoji: '👍', count: 2, mine: false }]);
  });

  it('incremente une reaction existante d autrui et la marque comme mienne', () => {
    expect(toggleLocally([{ emoji: '😂', count: 2, mine: false }], '😂')).toEqual([{ emoji: '😂', count: 3, mine: true }]);
  });
});
