import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Comment, CommentReaction, PaginatedResponse } from '../types';
import type { ReactionEmoji } from '@/constants/reactions';

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
    mutationFn: (body: { chantier_id: string; step_id?: string | null; content: string; reply_to_id?: string | null }) =>
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

type CommentsPage = PaginatedResponse<Comment & { first_name: string; last_name: string; avatar_url?: string }>;

/** Bascule ma reaction, en mettant a jour la liste tout de suite ; le serveur confirme ensuite. */
function toggleLocally(reactions: CommentReaction[] | undefined, emoji: ReactionEmoji): CommentReaction[] {
  const list = reactions ?? [];
  const existing = list.find((r) => r.emoji === emoji);
  if (!existing) return [...list, { emoji, count: 1, mine: true }];
  if (existing.mine) {
    return existing.count <= 1
      ? list.filter((r) => r.emoji !== emoji)
      : list.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r));
  }
  return list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
}

/**
 * Reagir a un message. Optimiste : la pastille apparait sous le doigt, sans
 * attendre le reseau, comme dans une messagerie. En cas d'erreur, on relit.
 */
export function useToggleReaction(chantierId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: ReactionEmoji }) =>
      apiFetch<{ comment_id: string; reactions: CommentReaction[] }>(`/comments/${id}/reactions`, {
        method: 'POST',
        body: { emoji },
      }),
    onMutate: async ({ id, emoji }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', chantierId] });
      queryClient.setQueriesData<CommentsPage>({ queryKey: ['comments', chantierId] }, (page) =>
        page
          ? { ...page, data: page.data.map((c) => (c.id === id ? { ...c, reactions: toggleLocally(c.reactions, emoji) } : c)) }
          : page,
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', chantierId] });
    },
    onSuccess: ({ comment_id, reactions }) => {
      queryClient.setQueriesData<CommentsPage>({ queryKey: ['comments', chantierId] }, (page) =>
        page ? { ...page, data: page.data.map((c) => (c.id === comment_id ? { ...c, reactions } : c)) } : page,
      );
    },
  });
}
