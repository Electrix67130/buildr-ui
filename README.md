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

## Documentation

- **[`CLAUDE.md`](CLAUDE.md)** — Guidelines projet pour les contributeurs
- **[`.claude/`](.claude/)** — Guides détaillés (TypeScript, naming, components, state/API, style/theme, perf/a11y)

## API

Le backend est dans [`buildr-api`](https://github.com/Electrix67130/buildr-api). Les endpoints consommés sont documentés dans [`docs/API.md`](https://github.com/Electrix67130/buildr-api/blob/master/docs/API.md) côté API.