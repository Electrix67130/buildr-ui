# State Management & API

## Hierarchie d'etat

| Scope | Outil | Exemple |
|---|---|---|
| Global | Context API | AuthContext |
| Serveur | TanStack React Query | `useQuery`, `useMutation` |
| Local | useState / useRef | Formulaires, modales |
| Persistant | AsyncStorage | Tokens, preferences |

## React Query

Configuration par defaut :
- `staleTime: 60 * 1000` (60 secondes)
- `retry: 2`

### CRUD Hooks Factory

```typescript
const chantierHooks = createCrudHooks('chantiers', chantiersApi);
// chantierHooks.useList(), useById(), useCreate(), useUpdate(), useRemove()
```

## API Client

- `apiFetch<T>(endpoint, options)` — wrapper fetch avec auto-refresh 401
- `setTokens()` / `clearTokens()` — gestion AsyncStorage
- `ApiError` — classe d'erreur avec statusCode
