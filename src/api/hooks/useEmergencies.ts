import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface EmergencyPhoto {
  id: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface Emergency {
  id: string;
  chantier_id: string;
  created_by: string;
  /** Premiere photo, conservee pour l'ancien affichage ; `photos` a toutes. */
  photo_url: string | null;
  thumbnail_url: string | null;
  photos?: EmergencyPhoto[];
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type EmergencyWithAuthor = Emergency & {
  first_name: string;
  last_name: string;
  role?: string;
  /** Calcule cote serveur : 'claim' si auteur est membre client, sinon 'emergency'. */
  type: 'emergency' | 'claim';
};

export interface CreateEmergencyInput {
  chantier_id: string;
  photo_url?: string;
  thumbnail_url?: string;
  photos?: { url: string; thumbnail_url?: string; file_size?: number; mime_type?: string }[];
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface PaginatedEmergencies {
  data: EmergencyWithAuthor[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useEmergencies(chantierId?: string) {
  return useQuery({
    queryKey: ['emergencies', chantierId],
    queryFn: () =>
      apiFetch<PaginatedEmergencies>(`/emergencies?chantier_id=${chantierId}&limit=100`),
    enabled: !!chantierId,
  });
}

export function useCreateEmergency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEmergencyInput) =>
      apiFetch<Emergency>('/emergencies', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['emergencies', variables.chantier_id] });
    },
  });
}

export function useDeleteEmergency(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/emergencies/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emergencies', chantierId] }),
  });
}
