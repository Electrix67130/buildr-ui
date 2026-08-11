import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import { createCrudHooks } from './useCrud';
import { chantiersApi } from '../services';
import type {
  Chantier,
  ChantierStatus,
  CreateChantierInput,
  PaginatedResponse,
  PaginationParams,
} from '../types';

// Standard CRUD hooks
export const chantierHooks = createCrudHooks<Chantier, never, never>('chantiers', chantiersApi);

// Active chantiers with optional status filter
export function useChantiers(params?: PaginationParams & { status?: ChantierStatus }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.orderBy) query.set('orderBy', params.orderBy);
  if (params?.order) query.set('order', params.order);
  const qs = query.toString();

  return useQuery({
    queryKey: ['chantiers', 'active', params],
    queryFn: () => apiFetch<PaginatedResponse<Chantier>>(`/chantiers${qs ? `?${qs}` : ''}`),
  });
}

// Search chantiers
export function useChantierSearch(q?: string, lat?: number, lng?: number, status?: ChantierStatus) {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (lat !== undefined) query.set('lat', String(lat));
  if (lng !== undefined) query.set('lng', String(lng));
  if (status) query.set('status', status);
  const qs = query.toString();

  return useQuery({
    queryKey: ['chantiers', 'search', { q, lat, lng, status }],
    queryFn: () => apiFetch<PaginatedResponse<Chantier & { distance_km?: number }>>(`/chantiers/search?${qs}`),
    enabled: (!!q && q.length > 0) || (lat !== undefined && lng !== undefined),
  });
}

// Archived chantiers
export function useChantierArchives(params?: PaginationParams & { q?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  return useQuery({
    queryKey: ['chantiers', 'archives', params],
    queryFn: () => apiFetch<PaginatedResponse<Chantier>>(`/chantiers/archives${qs ? `?${qs}` : ''}`),
  });
}

// Archive / Unarchive mutations
export function useArchiveChantier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Chantier>(`/chantiers/${id}/archive`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
    },
  });
}

export function useUnarchiveChantier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Chantier>(`/chantiers/${id}/unarchive`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
    },
  });
}

// Set retention (in years) for an already-archived chantier
export function useSetChantierRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, years }: { id: string; years: number }) =>
      apiFetch<Chantier>(`/chantiers/${id}/retention`, { method: 'PATCH', body: { years } }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
      if (data?.id) queryClient.setQueryData(['chantiers', 'detail', data.id], data);
    },
  });
}

// Update chantier
export function useUpdateChantier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<{
      name: string;
      description: string;
      address: string;
      city: string;
      postal_code: string;
      latitude: number;
      longitude: number;
      status: ChantierStatus;
      start_date: string;
      end_date: string;
    }> }) => apiFetch<Chantier>(`/chantiers/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
    },
  });
}

// Create chantier
export function useCreateChantier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChantierInput) =>
      apiFetch<Chantier>('/chantiers', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantiers'] });
    },
  });
}
