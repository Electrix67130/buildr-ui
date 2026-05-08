import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { ChantierMember, CreateChantierMemberInput, UpdateChantierMemberInput, PaginatedResponse, MeResponse } from '../types';

type MemberWithUser = ChantierMember & { first_name: string; last_name: string; email: string; phone?: string; company_name?: string };

export function useChantierMembers(chantierId?: string) {
  return useQuery({
    queryKey: ['chantier-members', chantierId],
    queryFn: () => apiFetch<PaginatedResponse<MemberWithUser>>(
      `/chantier-members/by-chantier?chantier_id=${chantierId}&limit=100`,
    ),
    enabled: !!chantierId,
    // Pas de polling : les events `chantier-member.*` via WebSocket invalident
    // la query en temps reel (cf. useRealtimeSync.ts).
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChantierMemberInput) =>
      apiFetch<ChantierMember>('/chantier-members', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chantier-members', variables.chantier_id] });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateChantierMemberInput }) =>
      apiFetch<ChantierMember>(`/chantier-members/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantier-members'] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/chantier-members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chantier-members'] });
    },
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => apiFetch<PaginatedResponse<MeResponse>>('/users?limit=100'),
  });
}

// --------------- Team (manager's team) ---------------

type TeamMemberWithUser = {
  id: string;
  manager_id: string;
  user_id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  company_name?: string;
};

export function useTeam(managerId?: string) {
  return useQuery({
    queryKey: ['team', managerId],
    queryFn: () => apiFetch<{ data: TeamMemberWithUser[] }>(`/teams/${managerId}`),
    enabled: !!managerId,
    staleTime: 0,
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { manager_id: string; user_id: string }) =>
      apiFetch('/teams', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team', variables.manager_id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['chantier-members'] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
