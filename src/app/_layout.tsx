import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import { installGlobalErrorHandler } from '@/api/errorReport';

// Preload logo pendant le splash screen
Asset.loadAsync(require('@/assets/images/casque-logo.png'));

SplashScreen.preventAutoHideAsync();

// Remontee des erreurs JavaScript non rattrapees vers error_log. Installe des
// le chargement du module, avant tout rendu.
installGlobalErrorHandler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
    },
  },
});

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
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
            <AuthGuard>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            </AuthGuard>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
