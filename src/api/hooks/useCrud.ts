import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { PaginationParams, PaginatedResponse } from '../types';

interface CrudApi<TEntity, TCreate, TUpdate> {
  list(params?: PaginationParams): Promise<PaginatedResponse<TEntity>>;
  getById(id: string): Promise<TEntity>;
  create(body: TCreate): Promise<TEntity>;
  update(id: string, body: TUpdate): Promise<TEntity>;
  remove(id: string): Promise<void>;
}

export function createCrudHooks<TEntity, TCreate = never, TUpdate = never>(
  key: string,
  api: CrudApi<TEntity, TCreate, TUpdate>,
) {
  return {
    useList(params?: PaginationParams, options?: Omit<UseQueryOptions<PaginatedResponse<TEntity>>, 'queryKey' | 'queryFn'>) {
      return useQuery({
        queryKey: [key, 'list', params],
        queryFn: () => api.list(params),
        ...options,
      });
    },

    useById(id: string | undefined, options?: Omit<UseQueryOptions<TEntity>, 'queryKey' | 'queryFn'>) {
      return useQuery({
        queryKey: [key, 'detail', id],
        queryFn: () => api.getById(id!),
        enabled: !!id,
        ...options,
      });
    },

    useCreate(options?: UseMutationOptions<TEntity, unknown, TCreate>) {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (body: TCreate) => api.create(body),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [key, 'list'] });
        },
        ...options,
      });
    },

    useUpdate(options?: UseMutationOptions<TEntity, unknown, { id: string; body: TUpdate }>) {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: ({ id, body }: { id: string; body: TUpdate }) => api.update(id, body),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [key] });
        },
        ...options,
      });
    },

    useRemove(options?: UseMutationOptions<void, unknown, string>) {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => api.remove(id),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [key, 'list'] });
        },
        ...options,
      });
    },
  };
}
