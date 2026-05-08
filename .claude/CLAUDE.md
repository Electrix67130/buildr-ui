# Buildr UI — Guidelines

Application mobile de gestion de chantiers. Stack : **React Native 0.81 + Expo 54 + TypeScript**.

## Commandes

```bash
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web browser
npm test           # Jest tests
npm run lint       # ESLint
```

## Architecture

```
src/
├── api/             # Client HTTP, services CRUD, hooks React Query
│   ├── client.ts    # apiFetch wrapper avec auto-refresh token
│   ├── services.ts  # createCrudApi factories
│   ├── types.ts     # Types API (entites, inputs, responses)
│   └── hooks/       # useCrud factory + hooks specifiques
├── app/             # Expo Router (file-based routing)
│   ├── (auth)/      # Login, Register
│   ├── (tabs)/      # 4 tabs : Chantiers, Equipe, Archives, Profil
│   └── chantier/    # Detail chantier, creation
├── components/      # Composants reutilisables
├── constants/       # Colors.ts, Layout.ts (design tokens)
├── contexts/        # AuthContext
├── hooks/           # Custom hooks
├── types/           # Types globaux
└── utils/           # Utilitaires
```

## Principes fondamentaux

- **Typage strict** : `strict: true`, jamais de `any`
- **Path alias** : `@/*` resolu vers `src/`
- **Design tokens** : jamais de magic numbers, utiliser `Layout.ts`
- **Theme** : `useColorScheme()` + `Colors[colorScheme]`
- **Accessibilite** : `accessibilityRole`, `accessibilityLabel` sur tous les elements interactifs
- **Performance** : `React.memo`, `useCallback`, `useMemo`, `FlatList`

## Guidelines detaillees

1. [TypeScript & Imports](./01-typescript.md)
2. [Conventions de nommage](./02-naming.md)
3. [Composants](./03-components.md)
4. [State & API](./04-state-api.md)
5. [Style & Theme](./05-style-theme.md)
6. [Performance & A11y](./06-performance-a11y.md)
