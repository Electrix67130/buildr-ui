import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import type { Document, CreateDocumentInput, DocumentType, PaginatedResponse } from '../types';

export function useDocuments(chantierId?: string, type?: DocumentType) {
  const params = new URLSearchParams();
  if (chantierId) params.set('chantier_id', chantierId);
  if (type) params.set('type', type);
  params.set('limit', '100');

  return useQuery({
    queryKey: ['documents', chantierId, type],
    queryFn: () => apiFetch<PaginatedResponse<Document & { first_name: string; last_name: string }>>(
      `/documents?${params.toString()}`,
    ),
    enabled: !!chantierId,
    staleTime: 0,
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDocumentInput) =>
      apiFetch<Document>('/documents', { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.chantier_id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
