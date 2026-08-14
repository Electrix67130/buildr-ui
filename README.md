# Buildr UI

Application mobile (Expo / React Native) pour la gestion de chantiers Buildr.

**Stack** : Expo Router + React Native + TypeScript + TanStack Query

## Démarrage rapide

### 1. Pré-requis

- Node.js ≥ 20
- L'API [`buildr-api`](https://github.com/Electrix67130/buildr-api) qui tourne (par défaut sur `http://localhost:3000`)
- Pour iOS : Xcode + Simulator (macOS)
- Pour Android : Android Studio + emulator
- Ou l'app **Expo Go** sur ton téléphone pour tester sans builder

### 2. Installation

```bash
npm install
cp .env.example .env
# édite .env avec l'URL de ton API
```

### 3. Lancer l'app

```bash
npm start              # menu interactif Metro
npm run ios            # build + ouvre simulateur iOS
npm run android        # build + ouvre emulator Android
npm run web            # version web (limitée)
npm run start:tunnel   # tunnel ngrok-like pour test sur device physique sans LAN
```

## Commandes

| Commande | Description |
|---|---|
| `npm start` | Démarre Metro en mode dev |
| `npm run ios` / `android` / `web` | Cible une plateforme spécifique |
| `npm run start:tunnel` | Démarre via tunnel (utile en réseau bridé) |
| `npm run lint` | Lint Expo |
| `npm test` | Lance les tests (Jest) |

## Architecture

```
src/
├── api/             # Client HTTP + hooks TanStack Query par ressource
│   ├── client.ts            # apiFetch (auth, refresh token, base URL)
│   ├── services.ts          # Wrappers REST par module
│   ├── types.ts             # Types partagés (Chantier, User…)
│   └── hooks/               # useChantiers, useAuth, useComments…
├── app/             # Pages (Expo Router — file-based routing)
│   ├── (auth)/      # Login, register, reset password, accept invite
│   ├── (tabs)/      # Tabs : accueil, chantiers, archives, profil…
│   ├── chantier/    # Détail d'un chantier + édition
│   └── templates/   # Templates de chantier
├── components/      # Composants réutilisables (StatusBadge, PhotoGallery…)
├── constants/       # Colors, Layout (spacing, radius, fontSize…)
├── contexts/        # Auth, Theme, I18n
├── hooks/           # useColorScheme, useKeyboardAwareModalStyle…
├── i18n/            # Traductions (FR/EN/…)
├── types/           # Types globaux
├── utils/           # Helpers (optimizeImage, formatters…)
└── assets/          # Logos, icônes, images
```

### Principes

- **TypeScript strict**, jamais de `any` non justifié.
- **Path aliases** : `@/*` → `src/*` (configuré dans `tsconfig.json` + `babel.config.cts`).
- **Theming** : palette dans `constants/Colors.ts`, thèmes light/dark/system gérés par `ThemeContext`.
- **i18n** : `useTranslation()` depuis `contexts/I18nContext`, traductions dans `i18n/translations.ts`.
- **Données serveur** : tout passe par TanStack Query (`useQuery` / `useMutation`), avec invalidation appropriée.
- **Auth** : `AuthContext` expose `user`, `login`, `logout`. Token refresh transparent dans `api/client.ts`.

## Variables d'environnement

Voir [`.env.example`](.env.example).

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL de l'API Buildr (ex: `http://localhost:3000` en dev, ou l'URL ngrok pour tester sur device) |

## Tests sur device physique

Pour tester sur ton téléphone en gardant l'API en local :

1. Démarre l'API (cf. [`buildr-api`](https://github.com/Electrix67130/buildr-api))
2. Démarre un tunnel ngrok vers `localhost:3000` (voir `scripts/ngrok-start.sh` dans le repo API)
3. Mets l'URL ngrok dans le `.env` de l'UI (`EXPO_PUBLIC_API_URL`)
4. `npm run start:tunnel`
5. Scanne le QR code avec Expo Go

## Build production

Via EAS Build (Expo Application Services) :

```bash
eas build --platform ios       # build iOS
eas build --platform android   # build Android
```

(EAS doit être configuré avec un compte Expo et `eas.json`.)

## Mises à jour OTA

Le code JavaScript peut être remplacé à distance, sans repasser par l'App Store
ni le Play Store. Une correction atteint les utilisateurs en quelques minutes au
lieu de plusieurs jours de review.

**Ce qui passe en OTA** : écrans, logique, styles, traductions, images du bundle.

**Ce qui exige un vrai build** : toute modification native — nouvelle
permission, nouveau module Expo, changement d'icône ou de nom, montée de version
du SDK. C'est le rôle de `runtimeVersion: { policy: "appVersion" }` : une mise à
jour n'est délivrée qu'aux builds portant la même version d'app, donc la même
couche native. Impossible de casser une app en poussant du JS qui suppose du
natif absent.

### Le flux, à respecter

```bash
npm run update:preview     # publie sur le canal preview
# on installe, on vérifie sur un vrai appareil
npm run update:promote     # promeut EXACTEMENT ce bundle en production
```

La promotion republie le bundle déjà testé, elle n'en reconstruit pas un
nouveau : ce qui part en production est ce qui a été validé.

`npm run update:production` publie directement en production, sans étape de
vérification. À réserver aux cas où le canal preview n'a pas de sens.

### En cas de problème

Une mauvaise mise à jour part chez tout le monde immédiatement, sans filet de
review. Pour revenir en arrière, on republie le groupe précédent :

```bash
eas update:list --branch <branche>          # retrouver le groupe sain
eas update:republish --group <group-id> --channel production
```

Les plantages remontent dans `/admin/errors` du dashboard avec la version
concernée, ce qui permet de savoir qu'une mise à jour a cassé quelque chose sans
attendre un appel.

### Canaux

| Canal | Profil de build | Usage |
|---|---|---|
| `development` | development | build de dev |
| `preview` | preview, simulator | validation avant promotion |
| `production` | production | App Store et Play Store |

L'OTA n'est actif que dans les builds **postérieurs** à l'ajout d'`expo-updates` :
un binaire compilé avant ne sait pas aller chercher de mise à jour.

## Documentation

- **[`CLAUDE.md`](CLAUDE.md)** — Guidelines projet pour les contributeurs
- **[`.claude/`](.claude/)** — Guides détaillés (TypeScript, naming, components, state/API, style/theme, perf/a11y)

## API

Le backend est dans [`buildr-api`](https://github.com/Electrix67130/buildr-api). Les endpoints consommés sont documentés dans [`docs/API.md`](https://github.com/Electrix67130/buildr-api/blob/master/docs/API.md) côté API.