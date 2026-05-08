import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface ChantierSubstep {
  id: string;
  step_id: string;
  name: string;
  position: number;
  validated_at: string | null;
  validated_by: string | null;
  validation_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChantierStep {
  id: string;
  chantier_id: string;
  name: string;
  position: number;
  validated_at: string | null;
  validated_by: string | null;
  validation_comment: string | null;
  substeps: ChantierSubstep[];
  created_at: string;
  updated_at: string;
}

const stepsKey = (chantierId: string) => ['chantier', chantierId, 'steps'] as const;

export function useChantierSteps(chantierId: string | undefined) {
  return useQuery({
    queryKey: stepsKey(chantierId ?? ''),
    queryFn: () => apiFetch<ChantierStep[]>(`/chantiers/${chantierId}/steps`),
    enabled: !!chantierId,
  });
}

export function useCreateStep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<ChantierStep>('/chantier-steps', { method: 'POST', body: { chantier_id: chantierId, name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useUpdateStep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<ChantierStep>(`/chantier-steps/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useDeleteStep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/chantier-steps/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useReorderSteps(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch<void>(`/chantiers/${chantierId}/steps/reorder`, { method: 'POST', body: { ordered_ids: orderedIds } }),
    onMutate: async (orderedIds) => {
      // 1. Apply the optimistic update SYNCHRONOUSLY before any await
      const previous = qc.getQueryData<ChantierStep[]>(stepsKey(chantierId));
      if (previous) {
        const byId = new Map(previous.map((s) => [s.id, s]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter((s): s is ChantierStep => !!s);
        qc.setQueryData(stepsKey(chantierId), reordered);
      }
      // 2. Then cancel any in-flight refetch so it doesn't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: stepsKey(chantierId) });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(stepsKey(chantierId), ctx.previous);
    },
    // No onSettled invalidation — server has the same data we already set, refetching would cause a brief flash.
    // If the server diverges, the next mount or focus refetch will reconcile.
  });
}

export function useCreateSubstep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, name }: { stepId: string; name: string }) =>
      apiFetch<ChantierSubstep>('/chantier-substeps', { method: 'POST', body: { step_id: stepId, name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useUpdateSubstep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, validation_comment }: { id: string; name?: string; validation_comment?: string | null }) =>
      apiFetch<ChantierSubstep>(`/chantier-substeps/${id}`, {
        method: 'PATCH',
        body: { name, validation_comment },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useDeleteSubstep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/chantier-substeps/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useReorderSubsteps(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, orderedIds }: { stepId: string; orderedIds: string[] }) =>
      apiFetch<void>(`/chantier-steps/${stepId}/substeps/reorder`, {
        method: 'POST',
        body: { ordered_ids: orderedIds },
      }),
    onMutate: async ({ stepId, orderedIds }) => {
      const previous = qc.getQueryData<ChantierStep[]>(stepsKey(chantierId));
      if (previous) {
        const updated = previous.map((s) => {
          if (s.id !== stepId) return s;
          const byId = new Map(s.substeps.map((sub) => [sub.id, sub]));
          return {
            ...s,
            substeps: orderedIds.map((id) => byId.get(id)).filter((sub): sub is ChantierStep['substeps'][number] => !!sub),
          };
        });
        qc.setQueryData(stepsKey(chantierId), updated);
      }
      await qc.cancelQueries({ queryKey: stepsKey(chantierId) });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(stepsKey(chantierId), ctx.previous);
    },
  });
}

export function useToggleSubstep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      validated,
      validation_comment,
    }: {
      id: string;
      validated: boolean;
      validation_comment?: string | null;
    }) =>
      apiFetch<ChantierSubstep>(`/chantier-substeps/${id}/toggle`, {
        method: 'POST',
        body: { validated, validation_comment },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}

export function useToggleStep(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      validated,
      validation_comment,
    }: {
      id: string;
      validated: boolean;
      validation_comment?: string | null;
    }) =>
      apiFetch<ChantierStep>(`/chantier-steps/${id}/toggle`, {
        method: 'POST',
        body: { validated, validation_comment },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: stepsKey(chantierId) }),
  });
}
