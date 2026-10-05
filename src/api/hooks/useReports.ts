import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../client';

export type ReportTarget = 'comment' | 'emergency_comment' | 'photo' | 'user';
export type ReportReason = 'inappropriate' | 'harassment' | 'off_topic' | 'other';
export const REPORT_REASONS: ReportReason[] = ['inappropriate', 'harassment', 'off_topic', 'other'];

export interface CreateReportInput {
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  comment?: string;
}

/** Signaler un message, une photo ou un membre a l'administrateur de l'organisation. */
export function useCreateReport() {
  return useMutation({
    mutationFn: (body: CreateReportInput) => apiFetch<{ id: string }>('/reports', { method: 'POST', body }),
  });
}
