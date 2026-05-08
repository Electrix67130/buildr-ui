import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type CalendarProvider = 'google' | 'outlook' | 'apple';

export interface CalendarIntegration {
  provider: CalendarProvider;
  connected: boolean;
  last_sync_at: string | null;
  ical_url?: string;
}

export function useCalendarIntegrations(enabled: boolean = true) {
  return useQuery({
    queryKey: ['calendar', 'integrations'],
    queryFn: () => apiFetch<CalendarIntegration[]>('/calendar/integrations'),
    enabled,
  });
}

export function useStartOAuth() {
  return useMutation({
    mutationFn: (provider: 'google' | 'outlook') =>
      apiFetch<{ auth_url: string }>(`/calendar/oauth/${provider}/start`, { method: 'POST' }),
  });
}

export function useConnectApple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CalendarIntegration>('/calendar/apple/connect', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar', 'integrations'] }),
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: CalendarProvider) =>
      apiFetch<void>(`/calendar/integrations/${provider}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar', 'integrations'] }),
  });
}
