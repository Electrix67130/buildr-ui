import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface EmergencyComment {
  id: string;
  emergency_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface PaginatedEmergencyComments {
  data: EmergencyComment[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateEmergencyCommentInput {
  emergency_id: string;
  content: string;
}

export function useEmergencyComments(emergencyId?: string) {
  return useQuery({
    queryKey: ['emergency-comments', emergencyId],
    queryFn: () =>
      apiFetch<PaginatedEmergencyComments>(`/emergency-comments?emergency_id=${emergencyId}&limit=200`),
    enabled: !!emergencyId,
    refetchInterval: 60000,
  });
}

export function useCreateEmergencyComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEmergencyCommentInput) =>
      apiFetch<EmergencyComment>('/emergency-comments', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['emergency-comments', variables.emergency_id] });
    },
  });
}

export function useUpdateEmergencyComment(emergencyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiFetch<EmergencyComment>(`/emergency-comments/${id}`, { method: 'PATCH', body: { content } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emergency-comments', emergencyId] }),
  });
}

export function useDeleteEmergencyComment(emergencyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/emergency-comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emergency-comments', emergencyId] }),
  });
}
