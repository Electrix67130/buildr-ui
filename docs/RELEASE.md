# Publier l'app mobile

Deux canaux, a ne pas confondre.

## Mise a jour en direct (JS seul)

```bash
npx -y eas-cli@latest update --channel production --auto
```

Part en quelques minutes a toutes les installations **de la meme version
native** (`version` dans `app.json`, politique `appVersion`). Depuis le passage
en 1.1.0, les installations 1.0.0 ne recoivent plus rien : il faut qu'elles
installent la 1.1.0 depuis les stores. Tout changement de module natif, de
permission ou d'`app.json` impose un build.

## Build natif

```bash
npx -y eas-cli@latest build --platform all --profile production --non-interactive --no-wait
```

Incrementer `version` dans `app.json` avant. Les builds durent 15 a 25 minutes
cote EAS ; `eas build:list` donne l'etat et les liens.

## Soumission iOS

```bash
npx -y eas-cli@latest submit -p ios --latest
```

Envoie le build a App Store Connect : il apparait dans TestFlight apres
traitement par Apple. La **mise en vente** reste manuelle dans App Store
Connect : creer la version, choisir le build, soumettre a la revue.

### Fiche App Store Connect (choix faits le 2026-10-05, premiere publication 1.1.0)

A ne pas refaire a chaque version, mais a savoir si Apple demande une mise a
jour ou si quelqu'un d'autre reprend la fiche :

- **Confidentialite** : sept types declares (nom, e-mail, telephone, position
  precise, photos ou videos, autre contenu utilisateur, identifiant
  utilisateur), tous lies a l'identite, aucun suivi, usage « fonctionnalites de
  l'app » seulement. Aucun SDK d'analyse ni de plantage dans l'app : si l'un
  d'eux arrive un jour, la declaration doit changer.
- **Classification** : 4+ calcule, **remplace par 18+** parce que les CGU
  reservent le service aux professionnels majeurs. Capacites : messagerie oui,
  contenu genere par les utilisateurs non (pas de large diffusion, les contenus
  restent dans l'equipe du chantier), publicite non.
- **Categorie** : Entreprise, secondaire Productivite. Droits de contenu : pas
  de contenu tiers. Gratuit. Disponible en France, Belgique, Luxembourg et
  Suisse, le perimetre des CGU.
- **Revue** : compte `demo@getbuildr.fr` (organisation « Buildr Demo »), notes
  en francais decrivant le parcours, la moderation (signalement, blocage) et
  l'usage des permissions position et notifications.

## Soumission Android

Google exige que le **premier** envoi d'une app soit fait a la main dans la Play
Console : creer l'app, puis televerser le fichier `.aab` du build (lien dans
`eas build:list`) dans une piste de test interne. Les envois suivants passent
par EAS :

```bash
npx -y eas-cli@latest submit -p android --latest
```

Il faut pour cela une **cle de compte de service** Google Play :

1. Play Console → Parametres → Acces a l'API → lier un projet Google Cloud.
2. Dans ce projet Cloud → IAM → Comptes de service → creer un compte, puis une
   cle au format JSON.
3. Play Console → Utilisateurs et autorisations → inviter l'adresse du compte
   de service avec le droit « Gerer les versions de production/test ».
4. Enregistrer la cle sous `google-play-service-account.json` a la racine du
   depot. Le fichier est ignore par git et ne doit jamais etre versionne.

`eas.json` (`submit.production.android`) pointe deja sur ce fichier et vise la
piste interne, promotion ensuite depuis la Play Console.
