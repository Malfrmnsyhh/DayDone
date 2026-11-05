import type {
  CreateLogDto,
  Log,
  LogListItem,
  Paginated,
  UpdateLogDto,
} from '@daydone/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface LogsListParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  search?: string;
}

/**
 * Hook untuk mengambil daftar logbook dengan filter & paginasi.
 */
export function useLogsList(params: LogsListParams = {}) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.from) queryParams.set('from', params.from);
  if (params.to) queryParams.set('to', params.to);
  if (params.search?.trim()) queryParams.set('search', params.search.trim());

  const queryStr = queryParams.toString();
  const endpoint = queryStr ? `/logs?${queryStr}` : '/logs';

  return useQuery<Paginated<LogListItem>>({
    queryKey: ['logs', 'list', params],
    queryFn: () => apiFetch<Paginated<LogListItem>>(endpoint),
  });
}

/**
 * Hook untuk mengambil logbook berdasarkan tanggal spesifik (misal hari ini).
 */
export function useLogByDate(date: string) {
  return useQuery<{ data: Log }>({
    queryKey: ['logs', 'by-date', date],
    queryFn: () => apiFetch<{ data: Log }>(`/logs/by-date/${date}`),
    retry: false, // 404 adalah kondisi wajar saat logbook tanggal tersebut belum dibuat
  });
}

/**
 * Hook untuk mengambil detail 1 logbook beserta lampirannya.
 */
export function useLogDetail(id?: string) {
  return useQuery<{ data: Log }>({
    queryKey: ['logs', 'detail', id],
    queryFn: () => apiFetch<{ data: Log }>(`/logs/${id}`),
    enabled: Boolean(id),
    retry: (failureCount, error: any) => {
      // Jangan retry jika 404 Not Found
      if (error?.statusCode === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Mutation hook untuk membuat logbook baru.
 */
export function useCreateLog() {
  const queryClient = useQueryClient();

  return useMutation<{ data: Log }, Error, CreateLogDto>({
    mutationFn: (dto) =>
      apiFetch<{ data: Log }>('/logs', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

/**
 * Mutation hook untuk memperbarui tanggal dan/atau deskripsi logbook.
 */
export function useUpdateLog(id: string) {
  const queryClient = useQueryClient();

  return useMutation<{ data: Log }, Error, UpdateLogDto>({
    mutationFn: (dto) =>
      apiFetch<{ data: Log }>(`/logs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

/**
 * Mutation hook untuk menghapus logbook.
 */
export function useDeleteLog() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/logs/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

