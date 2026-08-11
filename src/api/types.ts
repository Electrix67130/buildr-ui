// --------------- Pagination ---------------

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// --------------- Auth ---------------

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterOrgInput {
  siret?: string | null;
  legal_form?: string | null;
  vat_number?: string | null;
  naf_code?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  billing_email?: string | null;
  website?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: 'admin' | 'manager' | 'employee' | 'client' | 'gestionnaire_reseau';
  company_name?: string;
  invitation_token?: string;
  organization?: RegisterOrgInput;
}

export interface AuthResponse {
  user: MeResponse;
  access_token: string;
  refresh_token: string;
}

export type UserRole = 'admin' | 'manager' | 'employee' | 'client' | 'gestionnaire_reseau';

export interface Membership {
  organization_id: string;
  organization_name: string;
  role: UserRole;
}

export interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  /** Role dans l'organisation active (derive de la membership active). */
  role: UserRole;
  company_name?: string;
  is_active: boolean;
  push_enabled: boolean;
  created_at: string;
  updated_at: string;
  /** Id de l'organisation active (l'org dans laquelle l'utilisateur est en train de travailler). */
  organization_id?: string;
  active_organization_id?: string;
  /** Toutes les memberships de l'utilisateur (toutes les orgs auxquelles il appartient). */
  memberships?: Membership[];
}

// --------------- Chantier ---------------

export type ChantierStatus = 'a_venir' | 'en_cours' | 'termine';

export interface Chantier {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  status: ChantierStatus;
  start_date?: string;
  end_date?: string;
  created_by: string;
  archived_at?: string;
  auto_delete_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChantierInput {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  status?: ChantierStatus;
  start_date?: string;
  end_date?: string;
  manager_id?: string;
}

export interface UpdateChantierInput {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  status?: ChantierStatus;
  start_date?: string;
  end_date?: string;
}

// --------------- Chantier Member ---------------

export type ChantierMemberRole = 'manager' | 'ouvrier' | 'client' | 'gestionnaire_reseau';

export interface ChantierMember {
  id: string;
  chantier_id: string;
  user_id: string;
  role: ChantierMemberRole;
  can_view_comments: boolean;
  can_view_photos: boolean;
  can_view_documents: boolean;
  can_view_steps: boolean;
  can_view_team: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateChantierMemberInput {
  chantier_id: string;
  user_id: string;
  role?: ChantierMemberRole;
  can_view_comments?: boolean;
  can_view_photos?: boolean;
  can_view_documents?: boolean;
  can_view_steps?: boolean;
  can_view_team?: boolean;
  can_edit?: boolean;
}

export interface UpdateChantierMemberInput {
  role?: ChantierMemberRole;
  can_view_comments?: boolean;
  can_view_photos?: boolean;
  can_view_documents?: boolean;
  can_view_steps?: boolean;
  can_view_team?: boolean;
  can_edit?: boolean;
}

// --------------- Comment ---------------

export interface Comment {
  id: string;
  chantier_id: string;
  step_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentInput {
  chantier_id: string;
  step_id?: string | null;
  content: string;
}

export interface UpdateCommentInput {
  content?: string;
}

// --------------- Photo ---------------

export interface Photo {
  id: string;
  chantier_id: string;
  uploaded_by: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  taken_at?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePhotoInput {
  chantier_id: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  taken_at?: string;
  file_size?: number;
  mime_type?: string;
}

// --------------- Photo Comment ---------------

export interface PhotoComment {
  id: string;
  photo_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePhotoCommentInput {
  photo_id: string;
  content: string;
}

// --------------- Document ---------------

export type DocumentType = 'dict' | 'dt' | 'bon_de_commande' | 'plan' | 'arrete' | 'facture' | 'autre';

export interface Document {
  id: string;
  chantier_id: string;
  uploaded_by: string;
  name: string;
  type: DocumentType;
  url: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  chantier_id: string;
  name: string;
  type: DocumentType;
  url: string;
  file_size?: number;
  mime_type?: string;
}
