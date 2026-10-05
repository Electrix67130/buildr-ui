import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface BlockedUser {
  user_id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

/** Les personnes que j'ai bloquees. */
export function useBlocks() {
  return useQuery({
    queryKey: ['blocks'],
    queryFn: () => apiFetch<{ data: BlockedUser[] }>('/blocks'),
    select: (d) => d.data,
  });
}

/** Tout ce qui peut contenir du contenu de la personne : on relit. */
function invalidateContent(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['blocks'] });
  qc.invalidateQueries({ queryKey: ['auth', 'me'] });
  qc.invalidateQueries({ queryKey: ['comments'] });
  qc.invalidateQueries({ queryKey: ['photos'] });
  qc.invalidateQueries({ queryKey: ['emergency-comments'] });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch<{ user_id: string }>('/blocks', { method: 'POST', body: { user_id: userId } }),
    onSuccess: () => invalidateContent(qc),
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch<void>(`/blocks/${userId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateContent(qc),
  });
}
