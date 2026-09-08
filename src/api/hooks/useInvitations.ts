import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { PaginatedResponse } from '../types';

interface Invitation {
  id: string;
  email: string;
  invited_by: string;
  role: 'admin' | 'employee' | 'client';
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

/**
 * Invitations en attente de l'organisation.
 *
 * Reservee aux admins et aux managers cote API — la liste des invitations est un
 * outil d'administration. L'appeler pour un ouvrier ne rapporterait qu'un 403,
 * d'ou le drapeau `enabled` : c'est a l'ecran de savoir s'il a le droit de
 * demander.
 */
export function useInvitations(enabled = true) {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: () => apiFetch<PaginatedResponse<Invitation>>('/invitations?limit=100'),
    enabled,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role?: string; locale?: string }) =>
      apiFetch<Invitation>('/invitations', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}
