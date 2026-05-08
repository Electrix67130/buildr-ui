import { apiFetch } from './client';
import type { PaginationParams, PaginatedResponse } from './types';

// --------------- CRUD Factory ---------------

export function createCrudApi<TEntity, TCreate = never, TUpdate = never>(basePath: string) {
  return {
    list(params?: PaginationParams): Promise<PaginatedResponse<TEntity>> {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.orderBy) query.set('orderBy', params.orderBy);
      if (params?.order) query.set('order', params.order);
      const qs = query.toString();
      return apiFetch<PaginatedResponse<TEntity>>(`${basePath}${qs ? `?${qs}` : ''}`);
    },

    getById(id: string): Promise<TEntity> {
      return apiFetch<TEntity>(`${basePath}/${id}`);
    },

    create(body: TCreate): Promise<TEntity> {
      return apiFetch<TEntity>(basePath, { method: 'POST', body });
    },

    update(id: string, body: TUpdate): Promise<TEntity> {
      return apiFetch<TEntity>(`${basePath}/${id}`, { method: 'PATCH', body });
    },

    remove(id: string): Promise<void> {
      return apiFetch<void>(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}

// --------------- API Services ---------------

import type {
  Chantier,
  CreateChantierInput,
  UpdateChantierInput,
  ChantierMember,
  CreateChantierMemberInput,
  UpdateChantierMemberInput,
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
  Photo,
  CreatePhotoInput,
  PhotoComment,
  CreatePhotoCommentInput,
  Document,
  CreateDocumentInput,
  MeResponse,
} from './types';

export const chantiersApi = createCrudApi<Chantier, CreateChantierInput, UpdateChantierInput>('/chantiers');
export const chantierMembersApi = createCrudApi<ChantierMember, CreateChantierMemberInput, UpdateChantierMemberInput>('/chantier-members');
export const commentsApi = createCrudApi<Comment, CreateCommentInput, UpdateCommentInput>('/comments');
export const photosApi = createCrudApi<Photo, CreatePhotoInput, never>('/photos');
export const photoCommentsApi = createCrudApi<PhotoComment, CreatePhotoCommentInput, never>('/photo-comments');
export const documentsApi = createCrudApi<Document, CreateDocumentInput, never>('/documents');
export const usersApi = createCrudApi<MeResponse, never, Partial<MeResponse>>('/users');

// --------------- Push tokens ---------------

export const pushTokensApi = {
  register(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    return apiFetch<void>('/push-tokens', { method: 'POST', body: { token, platform } });
  },
  unregister(token: string): Promise<void> {
    return apiFetch<void>('/push-tokens', { method: 'DELETE', body: { token } });
  },
  setPreference(enabled: boolean): Promise<{ push_enabled: boolean }> {
    return apiFetch<{ push_enabled: boolean }>('/push-tokens/preference', {
      method: 'PATCH',
      body: { enabled },
    });
  },
};
