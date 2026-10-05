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
