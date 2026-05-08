# Conventions de nommage

| Element | Convention | Exemple |
|---|---|---|
| Composant | PascalCase | `ChantierCard.tsx` |
| Screen | PascalCase | `index.tsx`, `create.tsx` |
| Hook | camelCase + `use` | `useColorScheme.ts` |
| Contexte | PascalCase + `Context` | `AuthContext.tsx` |
| Utilitaire | camelCase | `dateFormatting.ts` |
| Type/Interface | PascalCase | `ChantierRow`, `LoginInput` |
| Constante | SCREAMING_SNAKE_CASE | `API_URL` |
| Style | camelCase dans StyleSheet | `container`, `headerTitle` |
| Dossier route | kebab-case entre parentheses | `(auth)`, `(tabs)` |

## Fichiers

- Un composant par fichier
- Nommer le fichier comme le composant (`ChantierCard.tsx`)
- Les screens suivent la convention Expo Router (file-based)
