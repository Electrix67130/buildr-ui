/**
 * Saisie et affichage des mentions.
 *
 * Le champ montre « @Paul Martin », l'API recoit « @[Paul Martin](id) ». Entre
 * les deux, une erreur previendrait la mauvaise personne, ou personne : un nom
 * retouche a la main ne doit plus etre une mention, un message modifie doit
 * garder les siennes.
 */
import {
  activeMentionQuery,
  insertMention,
  mentionsToText,
  parseMentions,
  serializeMentions,
  toEditable,
} from '@/utils/mentions';

const PAUL = '8f2c1a4e-3b5d-4c6e-9f70-1a2b3c4d5e6f';
const CLAIRE = '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b';

describe('Lecture', () => {
  it('decoupe un message en texte et mentions', () => {
    expect(parseMentions(`Salut @[Paul Martin](${PAUL}), tu viens ?`)).toEqual([
      { type: 'text', text: 'Salut ' },
      { type: 'mention', name: 'Paul Martin', id: PAUL },
      { type: 'text', text: ', tu viens ?' },
    ]);
  });

  it('laisse intact un message sans mention, et une adresse e-mail', () => {
    expect(parseMentions('ecrire a paul@exemple.fr')).toEqual([{ type: 'text', text: 'ecrire a paul@exemple.fr' }]);
  });

  it('affiche le nom a la place de la syntaxe', () => {
    expect(mentionsToText(`@[Paul Martin](${PAUL}) ok`)).toBe('@Paul Martin ok');
  });
});

describe('Saisie', () => {
  it('reconnait la mention en cours juste avant le curseur, espace compris', () => {
    expect(activeMentionQuery('Bonjour @Pa', 11)).toEqual({ start: 8, query: 'Pa' });
    expect(activeMentionQuery('@Paul Ma', 8)).toEqual({ start: 0, query: 'Paul Ma' });
    expect(activeMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  });

  it("ne prend pas une adresse e-mail ni un « @ » isole par un espace pour une mention", () => {
    expect(activeMentionQuery('paul@exemple', 12)).toBeNull();
    expect(activeMentionQuery('@ bonjour', 9)).toBeNull();
    expect(activeMentionQuery('@Paul\nsuite', 11)).toBeNull();
  });

  it('remplace la saisie par le nom choisi et place le curseur apres', () => {
    expect(insertMention('Salut @Pa', 6, 9, 'Paul Martin')).toEqual({ text: 'Salut @Paul Martin ', cursor: 19 });
    // Au milieu du texte, sans doubler l'espace qui suivait.
    expect(insertMention('@Cl et toi', 0, 3, 'Claire Durand')).toEqual({ text: '@Claire Durand et toi', cursor: 15 });
  });
});

describe('Envoi', () => {
  const mentions = [
    { id: PAUL, name: 'Paul' },
    { id: CLAIRE, name: 'Paul Martin' },
  ];

  it('transforme les noms choisis en mentions, le plus long d abord', () => {
    expect(serializeMentions('@Paul Martin et @Paul', mentions)).toBe(`@[Paul Martin](${CLAIRE}) et @[Paul](${PAUL})`);
  });

  it("un nom retouche a la main n'est plus une mention", () => {
    expect(serializeMentions('@Pau Martin', [{ id: CLAIRE, name: 'Paul Martin' }])).toBe('@Pau Martin');
  });

  it('un message modifie garde ses mentions', () => {
    const original = `@[Paul Martin](${PAUL}) les plans`;
    const { text, mentions: refs } = toEditable(original);
    expect(text).toBe('@Paul Martin les plans');
    expect(serializeMentions(`${text} sont arrives`, refs)).toBe(`@[Paul Martin](${PAUL}) les plans sont arrives`);
  });
});
