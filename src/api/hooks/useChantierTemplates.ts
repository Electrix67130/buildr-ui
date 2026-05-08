import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type ChantierStatus = 'a_venir' | 'en_cours' | 'termine';

export interface TemplateSubstepInput {
  id?: string;
  name: string;
}

export interface TemplateStepInput {
  id?: string;
  name: string;
  substeps?: TemplateSubstepInput[];
}

export interface TemplateMemberInput {
  user_id: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  default_status?: ChantierStatus;
  steps?: TemplateStepInput[];
  members?: TemplateMemberInput[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  default_status?: ChantierStatus;
  steps?: TemplateStepInput[];
  members?: TemplateMemberInput[];
}

export interface UseTemplateInput {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  start_date?: string;
  end_date?: string;
}

export interface ChantierTemplate {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  default_status: ChantierStatus;
  created_at: string;
  updated_at: string;
  steps: {
    id: string;
    template_id: string;
    name: string;
    position: number;
    substeps: { id: string; template_step_id: string; name: string; position: number }[];
  }[];
  members: {
    id: string;
    template_id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  }[];
}

const KEY = ['chantier-templates'] as const;

export function useChantierTemplates(enabled: boolean = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<ChantierTemplate[]>('/chantier-templates'),
    enabled,
  });
}

export function useChantierTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['chantier-templates', id],
    queryFn: () => apiFetch<ChantierTemplate>(`/chantier-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateChantierTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTemplateInput) =>
      apiFetch<ChantierTemplate>('/chantier-templates', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateChantierTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTemplateInput }) =>
      apiFetch<ChantierTemplate>(`/chantier-templates/${id}`, { method: 'PATCH', body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['chantier-templates', vars.id] });
    },
  });
}

export function useDeleteChantierTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/chantier-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UseTemplateInput }) =>
      apiFetch<{ id: string }>(`/chantier-templates/${id}/use`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chantiers'] }),
  });
}
