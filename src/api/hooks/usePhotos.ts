import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Photo, PhotoComment, CreatePhotoInput, PaginatedResponse } from '../types';

export function usePhotos(chantierId?: string) {
  return useQuery({
    queryKey: ['photos', chantierId],
    queryFn: () => apiFetch<PaginatedResponse<Photo & { first_name: string; last_name: string }>>(
      `/photos?chantier_id=${chantierId}&limit=100`,
    ),
    enabled: !!chantierId,
    staleTime: 0,
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  });
}

export function useCreatePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePhotoInput) =>
      apiFetch<Photo>('/photos', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos', variables.chantier_id] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

export function usePhotoComments(photoId?: string) {
  return useQuery({
    queryKey: ['photo-comments', photoId],
    queryFn: () => apiFetch<PaginatedResponse<PhotoComment & { first_name: string; last_name: string }>>(
      `/photo-comments?photo_id=${photoId}&limit=100`,
    ),
    enabled: !!photoId,
  });
}

export function useCreatePhotoComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { photo_id: string; content: string }) =>
      apiFetch<PhotoComment>('/photo-comments', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photo-comments', variables.photo_id] });
    },
  });
}
