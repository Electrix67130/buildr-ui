import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { PaginatedResponse } from '../types';

interface Invitation {
  id: string;
  email: string;
  invited_by: string;
  role: 'admin' | 'employee' | 'client';
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: () => apiFetch<PaginatedResponse<Invitation>>('/invitations?limit=100'),
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
