import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, setTokens, clearTokens } from '../client';
import { pushTokensApi } from '../services';
import type { LoginInput, RegisterInput, AuthResponse, MeResponse } from '../types';

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<MeResponse>('/auth/me'),
    enabled,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const result = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: input,
        auth: false,
      });
      await setTokens(result.access_token, result.refresh_token);
      return result;
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const result = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: input,
        auth: false,
      });
      await setTokens(result.access_token, result.refresh_token);
      return result;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MeResponse> }) =>
      apiFetch<MeResponse>(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdatePushPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => pushTokensApi.setPreference(enabled),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
      const previous = queryClient.getQueryData<MeResponse>(['auth', 'me']);
      if (previous) {
        queryClient.setQueryData<MeResponse>(['auth', 'me'], { ...previous, push_enabled: enabled });
      }
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) queryClient.setQueryData(['auth', 'me'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiFetch<{ message: string }>('/auth/password', { method: 'POST', body }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await apiFetch<void>('/auth/logout', { method: 'POST' });
      } finally {
        await clearTokens();
      }
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organization_id: string) =>
      apiFetch<{ active_organization_id: string; role: string }>('/auth/switch-organization', {
        method: 'POST',
        body: { organization_id },
      }),
    onSuccess: async () => {
      // Refetch toutes les queries — le contenu (chantiers, users, perms) depend de l'org active.
      // On utilise invalidateQueries (et pas clear) pour ne pas droper l'auth state.
      await queryClient.invalidateQueries();
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ id: string; name: string }>('/organizations', {
        method: 'POST',
        body: { name },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
