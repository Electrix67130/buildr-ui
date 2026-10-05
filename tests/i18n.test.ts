import { TRANSLATIONS, LOCALES } from '@/i18n/translations';

/**
 * Les textes vouvoient, dans toutes les langues qui le distinguent, et
 * chaque langue a exactement les memes cles : une cle oubliee dans une
 * langue afficherait son identifiant brut a l'ecran.
 */
describe('Traductions', () => {
  it('les huit langues sont declarees', () => {
    expect(LOCALES.map((l) => l.code).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pl', 'pt', 'tr']);
    for (const l of LOCALES) expect(l.flag.length).toBeGreaterThan(0);
  });

  it('chaque langue a les memes cles que le francais', () => {
    const ref = Object.keys(TRANSLATIONS.fr).sort();
    for (const code of Object.keys(TRANSLATIONS) as (keyof typeof TRANSLATIONS)[]) {
      expect(Object.keys(TRANSLATIONS[code]).sort()).toEqual(ref);
    }
  });

  it('le francais vouvoie', () => {
    // Pas de \b : il ignore les lettres accentuees, et « êtes » cacherait un « tes ».
    const tutoiement = /(?<![\p{L}'])(tu|toi|ton|ta|tes|t'as|t'es)(?!\p{L})/iu;
    const imperatifs = /^(Lance|Crée|Ajoute|Choisis|Clique|Renseigne|Sélectionne|Invite|Commence|Essaie|Saisis|Indique|Vérifie|Modifie|Retrouve|Découvre|Configure|Active|Pense|Garde|Donne|Mets|Tape|Glisse|Dépose|Prends|Reviens|Réessaie|Connecte|Rejoins|Télécharge|Partage|Envoie|Valide|Confirme|Décris|Explique|Sois|Fais|Vas|Ouvre|Ferme|Appuie|Note|Contacte|Utilise|Pose|Nomme) /;
    const fautes = Object.entries(TRANSLATIONS.fr)
      .filter(([, v]) => tutoiement.test(v) || imperatifs.test(v))
      .map(([k, v]) => `${k} = ${v}`);
    expect(fautes).toEqual([]);
  });
});
