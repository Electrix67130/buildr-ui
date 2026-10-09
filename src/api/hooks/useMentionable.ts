import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { MentionableUser } from '../types';

/**
 * Les personnes qu'on peut mentionner dans un fil : celles qui le lisent.
 * `emergency` pour le fil d'une urgence, ouvert a tous les participants.
 */
export function useMentionable(chantierId: string | undefined, thread: 'comments' | 'emergency' = 'comments') {
  return useQuery({
    queryKey: ['mentionable', chantierId, thread],
    queryFn: () =>
      apiFetch<MentionableUser[]>(`/chantier-members/mentionable?chantier_id=${chantierId}&thread=${thread}`),
    enabled: !!chantierId,
    staleTime: 5 * 60 * 1000,
  });
}
