# TypeScript & Imports

## Configuration

- `strict: true` (via `expo/tsconfig.base`)
- JSX : `react-jsx`
- Path alias : `@/*` → `src/*`

## Regles

- Jamais de `any` dans le code source
- Toujours typer les props de composants avec `interface`
- Utiliser `type` pour les unions et utilitaires
- Deriver les types depuis l'API (`api/types.ts`)
- `as const` pour les constantes

## Imports

- Toujours utiliser `@/` : `import { Colors } from '@/constants/Colors'`
- Pas d'import circulaire
- Import nomme par defaut, `export default` pour les composants/screens
