import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import { installGlobalErrorHandler } from '@/api/errorReport';
import { initOnlineManager } from '@/utils/network';
import { initPhotoQueue } from '@/utils/photoQueue';
import { persister, PERSIST_BUSTER } from '@/utils/persist';
import OfflineBanner from '@/components/OfflineBanner';

SplashScreen.preventAutoHideAsync();

// Remontee des erreurs JavaScript non rattrapees vers error_log. Installe des
// le chargement du module, avant tout rendu.
installGlobalErrorHandler();

// Detection reseau en JavaScript pur : met les requetes en pause hors ligne et
// les reprend au retour, sans module natif.
initOnlineManager();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // Conservation 24 h : une requete doit rester en cache assez longtemps
      // pour etre ecrite sur le disque et relue au demarrage suivant, sans
      // reseau. Avec la valeur par defaut (5 min), le cache persiste serait
      // vide des qu'on rouvre l'app le lendemain matin sur le chantier.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
    },
    mutations: {
      // Echec franc hors ligne plutot que mise en attente silencieuse : une
      // action qui semble avoir reussi alors qu'elle n'est jamais partie est
      // pire qu'une erreur. Les photos font exception — elles ont leur propre
      // file d'attente, visible et annoncee.
      networkMode: 'always',
    },
  },
});

// File d'attente des photos prises hors ligne, videe au retour du reseau.
initPhotoQueue(queryClient);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const splashHiddenRef = useRef(false);

  // WS realtime — actif des qu'authentifie. Sur close 4001 (session-replaced),
  // on declenche le logout immediatement.
  useRealtimeSync({
    enabled: isAuthenticated,
    onSessionReplaced: () => {
      logout();
    },
  });

  // Push notifications — register le token au login, navigue au tap.
  usePushNotifications(isAuthenticated);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }

    // Hide une seule fois — sinon expo-splash-screen renvoie une erreur sur les
    // appels suivants ("No native splash screen registered for given view controller").
    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {
        // Si le splash a deja ete ferme par le systeme, on ignore.
      });
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Le plus haut possible : une erreur dans un provider doit encore
          afficher l'ecran de secours plutot qu'un ecran blanc. */}
      <ErrorBoundary>
      {/* Le cache est ecrit sur le telephone et relu au demarrage : l'app
          reste consultable sans reseau, avec les dernieres donnees connues. */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, buster: PERSIST_BUSTER, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
            <AuthGuard>
            <StatusBar style="auto" />
            <OfflineBanner>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="+not-found" />
              </Stack>
            </OfflineBanner>
            </AuthGuard>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </PersistQueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
