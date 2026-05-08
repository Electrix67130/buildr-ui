import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken, clearTokens } from '@/api/client';
import { useMe, useLogin, useRegister, useLogout } from '@/api/hooks/useAuth';
import { unregisterCurrentPushToken } from '@/hooks/usePushNotifications';
import type { MeResponse, LoginInput, RegisterInput } from '@/api/types';

interface AuthContextValue {
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
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
