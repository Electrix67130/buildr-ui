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

## Conventions

### Nommage
- **Composants** : PascalCase (`ChantierCard.tsx`)
- **Hooks** : camelCase avec prefix `use` (`useColorScheme.ts`)
- **Utilitaires** : camelCase (`dateFormatting.ts`)
- **Types** : PascalCase dans fichiers dedies

### Imports
- Toujours utiliser l'alias `@/` (resolu vers `src/`)
- Exemple : `import { Colors } from '@/constants/Colors'`

### Composants
```typescript
interface Props { title: string; }
const Component: React.FC<Props> = ({ title }) => { ... };
const styles = StyleSheet.create({ ... });
export default Component;
```

### Typage
- `strict: true`, jamais de `any`
- Interface pour les props, type pour les unions
- Deriver les types depuis l'API (`api/types.ts`)

## Design Tokens

- **Pas de magic numbers** dans les StyleSheets
- Utiliser `Spacing`, `Radius`, `FontSize`, `FontWeight`, `Shadow`, `IconSize`, `AvatarSize` depuis `Layout.ts`
- Couleurs depuis `Colors.ts` via `useColorScheme()`

## Theme

```typescript
const colorScheme = useColorScheme();
const colors = Colors[colorScheme];
// Utiliser : colors.primary, colors.background, colors.text, etc.
```

## Palette BTP

- **Primary** : Amber/Orange (engins de chantier, gilets de securite)
- **Neutral** : Stone/Gris (beton, pierre)
- **Status** : Bleu (a venir), Amber (en cours), Vert (termine)

## State Management

- **Global** : Context API (AuthContext)
- **Server** : TanStack React Query via `createCrudHooks()`
- **Local** : useState/useRef

## Performance

- `React.memo` sur les composants de liste
- `useCallback` sur les handlers passes en props
- `useMemo` pour les calculs couteux
- `FlatList` pour les longues listes (pas ScrollView + .map)

## Accessibilite

- `accessibilityRole`, `accessibilityLabel` sur tous les elements interactifs
