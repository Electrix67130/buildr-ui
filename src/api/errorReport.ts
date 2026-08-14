import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

/**
 * Remontee des erreurs de l'app vers `error_log`, la meme table que les erreurs
 * serveur. Elles apparaissent dans la page /admin/errors du dashboard.
 *
 * Trois regles :
 * - **jamais bloquant** : un echec d'envoi est avale. Rien n'est plus absurde
 *   qu'un plantage du rapporteur d'erreurs.
 * - **jamais en cascade** : une meme signature n'est envoyee qu'une fois par
 *   session, sinon une erreur dans une boucle de rendu inonderait la table.
 * - **sans donnee metier** : on transmet le message, la pile et l'ecran, pas le
 *   contenu de ce que l'utilisateur manipulait.
 */

/** Signatures deja remontees, pour ne pas repeter la meme erreur. */
const alreadyReported = new Set<string>();

const APP_VERSION = [
  Constants.expoConfig?.version,
  Constants.expoConfig?.runtimeVersion,
]
  .filter(Boolean)
  .join(' / ') || 'inconnue';

function currentPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'web';
}

export async function reportError(
  error: unknown,
  context?: { screen?: string; level?: 'error' | 'warn' },
): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = `${err.name}: ${err.message}`;

    const signature = `${message}|${context?.screen ?? ''}`;
    if (alreadyReported.has(signature)) return;
    alreadyReported.add(signature);

    const token = await getAccessToken().catch(() => null);

    await fetch(`${API_URL}/error-reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        // Facultatif : rattache l'erreur a l'utilisateur quand il est connecte.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        level: context?.level ?? 'error',
        message: message.slice(0, 2000),
        stack: err.stack?.slice(0, 10000),
        source: 'mobile',
        platform: currentPlatform(),
        app_version: APP_VERSION,
        screen: context?.screen,
      }),
    });
  } catch {
    // Silencieux par construction.
  }
}

/**
 * Branche le handler global des erreurs JavaScript non rattrapees.
 *
 * On conserve le handler par defaut de React Native : c'est lui qui affiche
 * l'ecran rouge en developpement et termine proprement en production. On se
 * contente de l'observer.
 */
export function installGlobalErrorHandler(): void {
  const globalWithHandler = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const errorUtils = globalWithHandler.ErrorUtils;
  if (!errorUtils) return;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportError(error, { screen: isFatal ? 'fatal' : 'global' });
    previous(error, isFatal);
  });
}
