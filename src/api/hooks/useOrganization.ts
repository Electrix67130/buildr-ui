import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface Organization {
  id: string;
  name: string;
  archive_retention_years: number;
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
  logo_url?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  archive_retention_years?: number;
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
  logo_url?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
}

export function useOrganization(enabled: boolean = true) {
  return useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<Organization>('/organization'),
    enabled,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationInput) =>
      apiFetch<Organization>('/organization', { method: 'PATCH', body }),
    onSuccess: (data) => {
      qc.setQueryData(['organization'], data);
    },
  });
}
