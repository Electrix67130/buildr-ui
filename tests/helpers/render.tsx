/**
 * Rendu d'un composant dans les memes fournisseurs que l'app.
 *
 * React Query, le theme et la traduction sont les vrais : un composant qui
 * s'en sert mal doit echouer ici comme il echouerait sur un telephone. Seuls
 * l'API (`@/api/client`) et l'utilisateur connecte (`@/contexts/AuthContext`)
 * sont doubles, dans chaque fichier de test, par `jest.mock`.
 *
 * La langue est fixee au francais : sans preference enregistree, le
 * fournisseur suivrait la langue de la machine qui lance les tests.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import { I18nProvider } from '@/contexts/I18nContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

/** Un client neuf par test : aucun cache ne fuit d'un test a l'autre. */
export function creerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchInterval: false },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

export async function rendre(ui: React.ReactElement, options: RenderOptions & { queryClient?: QueryClient } = {}) {
  await AsyncStorage.setItem('app_locale', 'fr');
  const queryClient = options.queryClient ?? creerQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>{children}</I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
