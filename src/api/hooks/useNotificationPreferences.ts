import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { ChantierNotificationLevel, NotificationCategory, NotificationPreferences } from '../types';

const KEY = ['notification-preferences'] as const;

export function useNotificationPreferences() {
  return useQuery({ queryKey: KEY, queryFn: () => apiFetch<NotificationPreferences>('/notification-preferences') });
}

/** Une categorie a la fois, affichee tout de suite et retablie si l'API refuse. */
export function useUpdateNotificationCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { category: NotificationCategory; enabled: boolean }) =>
      apiFetch('/notification-preferences', { method: 'PATCH', body }),
    onMutate: async ({ category, enabled }) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(KEY);
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(KEY, {
          ...previous,
          categories: { ...previous.categories, [category]: enabled },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useChantierNotificationLevel(chantierId: string | undefined) {
  return useQuery({
    queryKey: ['notification-preferences', 'chantier', chantierId],
    queryFn: () =>
      apiFetch<{ chantier_id: string; level: ChantierNotificationLevel }>(`/notification-preferences/chantiers/${chantierId}`),
    enabled: !!chantierId,
  });
}

export function useSetChantierNotificationLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chantierId, level }: { chantierId: string; level: ChantierNotificationLevel }) =>
      apiFetch(`/notification-preferences/chantiers/${chantierId}`, { method: 'PUT', body: { level } }),
    onMutate: async ({ chantierId, level }) => {
      const key = ['notification-preferences', 'chantier', chantierId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, { chantier_id: chantierId, level });
      return { key, previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    // Rafraichit aussi la liste des chantiers en sourdine.
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
