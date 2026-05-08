import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Comment, PaginatedResponse } from '../types';

export function useComments(chantierId?: string, stepFilter?: string | 'general') {
  return useQuery({
    queryKey: ['comments', chantierId, stepFilter ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams({ chantier_id: chantierId!, limit: '100', order: 'asc' });
      if (stepFilter) params.set('step_id', stepFilter);
      return apiFetch<PaginatedResponse<Comment & { first_name: string; last_name: string; avatar_url?: string }>>(
        `/comments?${params.toString()}`,
      );
    },
    enabled: !!chantierId,
    staleTime: 0,
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { chantier_id: string; step_id?: string | null; content: string }) =>
      apiFetch<Comment>('/comments', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.chantier_id] });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiFetch<Comment>(`/comments/${id}`, { method: 'PATCH', body: { content } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
