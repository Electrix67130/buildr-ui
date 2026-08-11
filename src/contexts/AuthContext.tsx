import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken, clearTokens } from '@/api/client';
import { useMe, useLogin, useRegister, useLogout, useDeleteAccount } from '@/api/hooks/useAuth';
import { unregisterCurrentPushToken } from '@/hooks/usePushNotifications';
import type { MeResponse, LoginInput, RegisterInput } from '@/api/types';

interface AuthContextValue {
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    getAccessToken().then((token) => {
      setHasToken(!!token);
      setTokenChecked(true);
    });
  }, []);

  const queryClient = useQueryClient();
  const { data: user, isLoading: meLoading, isError: meFailed } = useMe(hasToken);
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();
  const deleteAccountMutation = useDeleteAccount();

  // If /auth/me fails (token expired + refresh failed), force logout
  useEffect(() => {
    if (hasToken && meFailed) {
      clearTokens().then(() => setHasToken(false));
    }
  }, [hasToken, meFailed]);

  const login = useCallback(
    async (input: LoginInput) => {
      await loginMutation.mutateAsync(input);
      setHasToken(true);
    },
    [loginMutation],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await registerMutation.mutateAsync(input);
      setHasToken(true);
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    // Desenregistre le token push AVANT de clear l'auth — sinon DELETE 401.
    await unregisterCurrentPushToken();
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Ignore errors — clear tokens anyway
    }
    await clearTokens();
    queryClient.clear();
    setHasToken(false);
  }, [logoutMutation, queryClient]);

  /**
   * Supprime definitivement le compte, puis vide la session locale.
   *
   * Contrairement au logout, on supprime AVANT de toucher au token push : le serveur
   * purge deja les push_token, et un echec (mot de passe errone, dernier admin de
   * l'organisation) doit laisser la session parfaitement intacte. L'erreur remonte
   * volontairement a l'appelant pour etre affichee.
   */
  const deleteAccount = useCallback(
    async (password: string) => {
      await deleteAccountMutation.mutateAsync({ password });
      // Le DELETE distant 401 desormais, mais l'appel remet currentPushToken a null.
      await unregisterCurrentPushToken();
      await clearTokens();
      queryClient.clear();
      setHasToken(false);
    },
    [deleteAccountMutation, queryClient],
  );

  const isLoading = !tokenChecked || (hasToken && meLoading && !meFailed);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAuthenticated: hasToken && !!user && !meFailed,
        isLoading,
        login,
        register,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
