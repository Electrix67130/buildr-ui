import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type ChantierTab =
  | 'comments'
  | 'comments_steps'
  | 'photos'
  | 'documents'
  | 'emergencies'
  | 'emergencies_claim';

export interface UnreadCounts {
  comments: number;
  comments_steps: number;
  photos: number;
  documents: number;
  emergencies: number;
  emergencies_claim: number;
  /** IDs des étapes avec un message non-lu */
  unread_step_ids: string[];
  /** IDs des urgences/réclamations avec activité non-lue */
  unread_emergency_ids: string[];
}

export function useUnreadCounts(chantierId?: string) {
  return useQuery({
    queryKey: ['chantier-views', 'unread', chantierId],
    queryFn: () => apiFetch<UnreadCounts>(`/chantier-views/unread?chantier_id=${chantierId}`),
    enabled: !!chantierId,
    refetchInterval: 60000,
  });
}

export interface UnreadSummary {
  by_chantier: Record<string, number>;
  by_organization: Record<string, number>;
}

export function useUnreadSummary(enabled: boolean = true) {
  return useQuery({
    queryKey: ['chantier-views', 'unread-summary'],
    queryFn: () => apiFetch<UnreadSummary>('/chantier-views/unread-summary'),
    enabled,
    refetchInterval: 60000,
  });
}

/** Marque un item précis (étape ou urgence) comme vu — efface sa pastille spécifique. */
export function useMarkItemViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item_type, item_id }: { item_type: 'step' | 'emergency'; item_id: string }) =>
      apiFetch<void>('/chantier-views/item', { method: 'POST', body: { item_type, item_id } }),
    onSettled: () => {
      // On invalide tous les unread car on ne sait pas dans quel chantier l'item se trouve.
      qc.invalidateQueries({ queryKey: ['chantier-views'] });
    },
  });
}

export function useMarkTabViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chantier_id, tab }: { chantier_id: string; tab: ChantierTab }) =>
      apiFetch<void>('/chantier-views', { method: 'POST', body: { chantier_id, tab } }),
    onMutate: async ({ chantier_id, tab }) => {
      // Optimistic : on enleve la pastille immediatement dans le cache, sans attendre
      // l'aller-retour reseau. Sinon le delai (~200ms) fait que la pastille reste visible
      // jusqu'au prochain clic et donne l'impression qu'elle s'efface "au tab d'apres".
      await qc.cancelQueries({ queryKey: ['chantier-views', 'unread', chantier_id] });
      await qc.cancelQueries({ queryKey: ['chantier-views', 'unread-summary'] });

      const prevUnread = qc.getQueryData<UnreadCounts>(['chantier-views', 'unread', chantier_id]);
      const prevSummary = qc.getQueryData<UnreadSummary>(['chantier-views', 'unread-summary']);

      const tabCount = prevUnread?.[tab] ?? 0;

      if (prevUnread) {
        qc.setQueryData<UnreadCounts>(['chantier-views', 'unread', chantier_id], {
          ...prevUnread,
          [tab]: 0,
        });
      }

      // Decremente le total chantier dans le summary, et propage sur les organisations
      // (on ne connait pas l'org_id ici, donc on retire du chantier et l'invalidation
      // onSettled corrigera l'org si besoin).
      if (prevSummary && tabCount > 0) {
        const currentChantierTotal = prevSummary.by_chantier[chantier_id] ?? 0;
        const newChantierTotal = Math.max(0, currentChantierTotal - tabCount);
        const next: UnreadSummary = {
          by_chantier: { ...prevSummary.by_chantier },
          by_organization: { ...prevSummary.by_organization },
        };
        if (newChantierTotal === 0) delete next.by_chantier[chantier_id];
        else next.by_chantier[chantier_id] = newChantierTotal;
        qc.setQueryData<UnreadSummary>(['chantier-views', 'unread-summary'], next);
      }

      return { prevUnread, prevSummary };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevUnread) {
        qc.setQueryData(['chantier-views', 'unread', vars.chantier_id], ctx.prevUnread);
      }
      if (ctx?.prevSummary) {
        qc.setQueryData(['chantier-views', 'unread-summary'], ctx.prevSummary);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['chantier-views', 'unread', vars.chantier_id] });
      qc.invalidateQueries({ queryKey: ['chantier-views', 'unread-summary'] });
    },
  });
}
