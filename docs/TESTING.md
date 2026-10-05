# Tests de l'app mobile

Jest avec le preset `jest-expo`, et `@testing-library/react-native` pour les
composants et les hooks. Tout tourne en Node, sans simulateur ni appareil.

## Lancer

```bash
npx jest                         # toute la suite (ou npm test)
npx jest tests/client.test.ts    # un fichier
npx jest -t "renouvellement"     # les tests dont le nom contient ce texte
npx jest --watch                 # relance a chaque modification
npx tsc --noEmit                 # les tests sont types comme le reste
```

Le premier lancement apres un `npm ci` prend une a deux minutes : Babel
transforme `react-native`, les traductions et les icones, puis met le resultat
en cache.

## Configuration

- `package.json`, cle `jest` : preset `jest-expo`, fichier de preparation
  `tests/setup.ts`, et `tests/helpers/` exclu de la recherche de tests.
- `tests/setup.ts` : remplace AsyncStorage par sa doublure memoire officielle.
  C'est le seul module natif double globalement.
- `react-test-renderer` est epingle sur la version exacte de `react` (19.1.0) :
  `@testing-library/react-native` l'exige, et deux versions differentes
  refusent de fonctionner ensemble. A monter en meme temps que `react`.
- Reanimated et `react-native-gesture-handler` ne sont pas doubles : jest-expo
  les fait tourner en JavaScript.

## Simuler l'API

L'API n'est jamais appelee. Selon ce qu'on teste :

- **Composant ou hook qui passe par `apiFetch`** : on double `@/api/client` dans
  le fichier de test, et on route selon l'URL appelee.

  ```ts
  const mockApiFetch = jest.fn();
  jest.mock('@/api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

  mockApiFetch.mockImplementation(async (endpoint: string, options?: { method?: string }) => {
    if (endpoint.startsWith('/comments?')) return { data: FIL, total: FIL.length };
    return {};
  });
  ```

  Le nom doit commencer par `mock` : jest remonte `jest.mock` en tete de
  fichier et refuse toute autre variable exterieure dans la fabrique.
- **Le client lui-meme** (`tests/client.test.ts`) : on remplace `global.fetch`
  par un `jest.fn` qui rend des reponses programmees dans l'ordre, et on lit les
  jetons directement dans la doublure d'AsyncStorage.
- **Envoi de fichiers** : `@/api/upload` (`uploadFile`) et
  `@/utils/optimizeImage` sont doubles ; `expo-file-system/legacy` et
  `expo-image-picker` aussi, par des objets de `jest.fn`.
- **WebSocket** : une classe `FausseWebSocket` remplace `global.WebSocket`
  (`tests/useRealtimeSync.test.tsx`) ; le test declenche lui-meme
  `onopen`, `onmessage` et `onclose` avec le code voulu.
- **Utilisateur connecte** : `@/contexts/AuthContext` est double par
  `jest.mock(..., () => ({ useAuth: () => ({ user: MOI }) }))`.

## Ecrire un test de composant

`tests/helpers/render.tsx` fournit `rendre(ui)`, qui monte le composant dans un
`QueryClient` neuf (sans nouvel essai ni rafraichissement periodique), le vrai
`ThemeProvider` et le vrai `I18nProvider`, langue fixee au francais. On cherche
les elements comme un utilisateur les voit : texte, role et nom accessible.

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { rendre } from './helpers/render';

await rendre(<ReportSheet target={CIBLE} onClose={onClose} />);
fireEvent.press(await screen.findByRole('radio', { name: /Harcèlement/ }));
fireEvent.press(screen.getByRole('button', { name: /Envoyer le signalement/ }));
await waitFor(() => expect(onClose).toHaveBeenCalled());
```

Pour un hook sans rendu, `renderHook` avec un `QueryClientProvider` en
enveloppe (`creerQueryClient()` est exporte par le meme fichier).

Conventions, reprises de `buildr-api/tests` :

- un commentaire d'en-tete par fichier, qui dit pourquoi ce comportement compte
  pour l'utilisateur, pas seulement ce que fait le code ;
- `describe` et `it` en francais, qui decrivent un comportement ;
- des doublures declarees hors des fabriques quand le module est recharge par
  `jest.isolateModules` (voir l'en-tete de `tests/photoQueue.test.ts`).

### Animations et minuteries

Reanimated tourne en JavaScript. Pour lire un style anime, on le pose sur un
`Animated.View` puis `getAnimatedStyle(element)` ; `jest.useFakeTimers()` et
`jest.advanceTimersByTime()` font avancer les `withTiming`. Apres un
`rerender`, avancer d'une image (quelques ms) avant de lire le style. Les
evenements du clavier sont captes en espionnant `Keyboard.addListener`.

### Comportements suspects connus : `it.failing`

Un defaut constate mais pas encore corrige est decrit par un `it.failing` dans
un bloc `Comportements suspects connus` : le test exprime le comportement
attendu, echoue aujourd'hui, et la suite reste verte. Le jour ou le defaut est
corrige, jest le signale en rouge : retirer alors `.failing`.

## Fichiers de test

| Fichier | Objet | Tests |
|---|---|---|
| `tests/exif.test.ts` | Lecture du lieu et de l'heure de prise de vue (formes iOS et Android, valeurs hors bornes) | 6 |
| `tests/photoQueue.test.ts` | File hors ligne des photos : copie durable, redemarrage, ordre, echecs, reprise, coordonnees transmises a `/photos` | 19 (dont 1 `it.failing`) |
| `tests/reactions.test.ts` | Calcul optimiste des reactions (`toggleLocally`) | 4 |
| `tests/pickPhoto.test.ts` | Selection multiple, metadonnees lues avant l'optimisation, annulation et permissions refusees | 7 |
| `tests/client.test.ts` | Client API : renouvellement du jeton au 401 et rejeu, 502 qui garde les jetons, 401 qui les vide, renouvellement unique | 10 |
| `tests/useRealtimeSync.test.tsx` | WebSocket : codes 4001/4002/4003, reconnexion espacee, invalidations par evenement | 13 (dont 1 `it.failing`) |
| `tests/useKeyboardAwareModalStyle.test.tsx` | Remontee des fenetres au-dessus du clavier : ancrage bas ou centre, fenetre fermee, soubresauts iOS | 10 |
| `tests/ReportSheet.test.tsx` | Fenetre de signalement : rien sans motif, corps envoye a `/reports`, echec | 5 |
| `tests/CommentThread.test.tsx` | Menu d'un message selon l'auteur, confirmation du blocage, reponse citee | 4 |
