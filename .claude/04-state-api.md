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
- `gcTime: 24 h` — necessaire au mode hors ligne : une requete doit rester en
  cache assez longtemps pour etre ecrite sur le disque et relue le lendemain
- `mutations.networkMode: 'always'` — une ecriture tentee hors ligne echoue
  franchement au lieu d'etre rejouee en silence

### CRUD Hooks Factory

```typescript
const chantierHooks = createCrudHooks('chantiers', chantiersApi);
// chantierHooks.useList(), useById(), useCreate(), useUpdate(), useRemove()
```

## API Client

- `apiFetch<T>(endpoint, options)` — wrapper fetch avec auto-refresh 401
- `setTokens()` / `clearTokens()` — gestion AsyncStorage
- `ApiError` — classe d'erreur avec statusCode


## Mode hors ligne

Un chantier est souvent mal couvert. L'app reste donc consultable sans reseau,
et les photos prises sur place ne sont jamais perdues.

Tout est en JavaScript, sans module natif : **livrable en mise a jour OTA**.

| Fichier | Role |
|---|---|
| `utils/network.ts` | Sonde `GET /health` (4 s) qui pilote l'`onlineManager` de React Query. Resondee au retour au premier plan et toutes les 20 s. |
| `utils/persist.ts` | Ecriture du cache React Query sur AsyncStorage, et purge a la deconnexion. |
| `utils/photoQueue.ts` | File d'attente des photos prises hors ligne, videe au retour du reseau. |
| `components/OfflineBanner.tsx` | Bandeau d'etat, qui pousse le contenu au lieu de le recouvrir. |

**On sonde l'API, pas l'interface reseau** : une barre de signal ne dit pas
qu'un serveur repond. Le cas courant est le Wi-Fi du bureau de chantier auquel
on est connecte sans acces a internet.

**Lecture partout, ecriture pour les seules photos.** C'est le geste le plus
frequent sur place et le plus couteux a perdre. Les autres actions echouent
franchement : une action qui semble avoir reussi alors qu'elle n'est jamais
partie est pire qu'une erreur.

**L'heure de prise de vue accompagne la photo** (`taken_at`), sinon une photo du
matin remontee le soir apparaitrait a l'heure de l'envoi et le fil d'avancement
du chantier mentirait.

**Le cache persiste est efface a la deconnexion** : il contient les chantiers,
les adresses et les discussions. Sur un telephone partage entre deux ouvriers,
les laisser serait une fuite.

Tests : `tests/photoQueue.test.ts` (`npm test`). C'est le seul endroit de l'app
ou une donnee existe uniquement sur le telephone — une erreur y perd le travail
d'un ouvrier en silence.
