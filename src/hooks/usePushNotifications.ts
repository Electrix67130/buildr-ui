import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { pushTokensApi } from '@/api/services';

// Token courant pour ce device — partage entre le hook (qui le set au register)
// et le logout (qui doit faire DELETE /push-tokens AVANT de clear l'auth).
let currentPushToken: string | null = null;

/** Recupere le token enregistre pour ce device (null si pas encore enregistre). */
export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

/**
 * DELETE le token actuel cote backend. A appeler depuis le logout AVANT
 * de clear les tokens d'auth (sinon la requete 401).
 */
export async function unregisterCurrentPushToken(): Promise<void> {
  if (!currentPushToken) return;
  try {
    await pushTokensApi.unregister(currentPushToken);
  } catch {
    // Si l'appel echoue (offline, 401), on ignore — le backend nettoiera
    // de toute facon a la prochaine emission via DeviceNotRegistered.
  }
  currentPushToken = null;
}

// Affichage des notifs en foreground : alert + son.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D97706',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  console.log('[push] permission existing:', existing);
  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
    console.log('[push] permission requested ->', requested);
  }
  if (status !== 'granted') {
    console.warn('[push] permission denied — abort');
    return null;
  }

  // En Expo Go le projectId n'est pas requis ; en standalone il l'est.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  console.log('[push] projectId:', projectId ?? '(none — Expo Go mode)');
  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    console.log('[push] token obtained:', tokenResult.data);
    return tokenResult.data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

interface PushNotificationData {
  type?: string;
  chantier_id?: string;
}

/**
 * Hook actif tant que l'utilisateur est authentifie.
 * - Demande la permission, recupere le token Expo et l'enregistre cote backend.
 * - Ecoute les taps sur les notifs et navigue vers le chantier concerne.
 * Le DELETE du token cote backend se fait via `unregisterCurrentPushToken`
 * appele depuis le logout (avant le clear des tokens d'auth).
 */
export function usePushNotifications(enabled: boolean): void {
  const router = useRouter();
  const respondedRef = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    let cancelled = false;
    (async () => {
      console.log('[push] hook enabled — starting registration');
      const token = await registerForPushNotificationsAsync();
      if (cancelled || !token) return;
      currentPushToken = token;
      try {
        await pushTokensApi.register(
          token,
          Platform.OS === 'ios' ? 'ios' : 'android',
        );
        console.log('[push] token registered with backend');
      } catch (err) {
        console.warn('[push] backend registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    // Navigation au tap d'une notif (foreground OU background).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as PushNotificationData;
      if (data?.chantier_id) {
        router.push(`/chantier/${data.chantier_id}`);
      }
    });

    // Si l'app a ete cold-started par un tap, on traite la reponse initiale une fois.
    (async () => {
      if (respondedRef.current) return;
      respondedRef.current = true;
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        const data = last.notification.request.content.data as PushNotificationData;
        if (data?.chantier_id) {
          router.push(`/chantier/${data.chantier_id}`);
        }
      }
    })();

    return () => {
      sub.remove();
    };
  }, [enabled, router]);
}
