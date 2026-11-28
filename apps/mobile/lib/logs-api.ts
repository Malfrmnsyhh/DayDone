import type { Log, LogStats, LogListItem, Paginated } from "@daydone/shared";
import { SIGNED_URL_TTL_SECONDS } from "@daydone/shared";
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, apiFetch } from "./api-client";

export const DEFAULT_LOGS_PAGE_LIMIT = 20;
export const SIGNED_URL_STALE_TIME_MS = (SIGNED_URL_TTL_SECONDS - 60) * 1000;

export interface LogsListParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  search?: string;
}

/**
 * Membangun path ednpoint GET /logs dengan query string bersih
 */
export const buildLogsListEndpoint = (params: LogsListParams = {}): string => {
  const queryParams = new URLSearchParams();

  if (params.page && params.page > 0) {
    queryParams.set("page", String(params.page));
  }
  if (params.limit && params.limit > 0) {
    queryParams.set("limit", String(params.limit));
  }
  if (params.from) {
    queryParams.set("from", params.from);
  }
  if (params.to) {
    queryParams.set("to", params.to);
  }
  if (params.search?.trim()) {
    queryParams.set("search", params.search.trim());
  }

  const queryStr = queryParams.toString();
  return queryStr ? `/logs?${queryStr}` : "/logs";
};

/**
 * Menentukan nomor halaman berikutnya untuk infinite scroll flatlist
 * mengembalikan undifined bila sudah di halaman terkhir
 */
export const getNextLogsPageParam = (
  lastPage: Paginated<LogListItem>,
): number | undefined => {
  if (lastPage.meta.page < lastPage.meta.totalPages) {
    return lastPage.meta.page + 1;
  }
  return undefined;
};

/**
 * Mengecek apakah error dari API adalah 404 Not Found.
 */
export const isNotFoundError = (error: unknown): boolean => {
  return error instanceof ApiError && error.statusCode === 404;
};

/**
 * mengambil daftar logbook dengan infinite scroll (default 20 item per halaman)
 */
export function useLogsList(params: Omit<LogsListParams, "page"> = {}) {
  const limit = params.limit ?? DEFAULT_LOGS_PAGE_LIMIT;
  const search = params.search?.trim() || undefined;

  return useInfiniteQuery<Paginated<LogListItem>>({
    queryKey: ["logs", "list", { ...params, limit, search }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiFetch<Paginated<LogListItem>>(
        buildLogsListEndpoint({
          ...params,
          limit,
          search,
          page: typeof pageParam === "number" ? pageParam : 1,
        }),
      ),
    getNextPageParam: getNextLogsPageParam,
  });
}

/**
 * Mengambil logbook untuk tanggal tertentu (YYYY-MM-DD), misalnya hari ini.
 * Jika backend membalas 404 (belum diisi), kembalikan null agar UI mudah
 * membedakan antara "belum diisi" vs "error jaringan/server".
 */
export function useLogByDate(date: string) {
  return useQuery<Log | null>({
    queryKey: ["logs", "by-date", date],
    queryFn: async () => {
      try {
        return await apiFetch<Log>(`/logs/by-date/${date}`);
      } catch (error: unknown) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },
  });
}

/**
 * Mengambil statistik ringkasan logbook per bulan (GET /logs/stats?month=YYYY-MM).
 */
export function useLogStats(month: string) {
  return useQuery<LogStats>({
    queryKey: ["logs", "stats", month],
    queryFn: () =>
      apiFetch<LogStats>(`/logs/stats?month=${encodeURIComponent(month)}`),
  });
}

/**
 * mengambil detail 1 logbook beserta daftar lampiran foto (signed URL)
 * tidal retry bila 404 not found
 */
export const useLogDetail = (id?: string) => {
    return useQuery<Log>({
        queryKey: ['logs', 'detail', id],
        queryFn: () => apiFetch<Log>(`/logs/${id}`),
        enabled: Boolean(id),
        staleTime: SIGNED_URL_STALE_TIME_MS,
        retry: (failureCount, error) => {
            if (isNotFoundError(error)) {
                return false;
            }
            return failureCount < 2;
        },
    });
}

/**
 * Menghapus logbook (DELETE /logs/:id) dan menginvalidasi seluruh cache ['logs']
 * agar beranda, statistik dan daftar otomatis sinkron
 */
export const useDeleteLog = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: (id) => 
            apiFetch<void>(`/logs/${id}`, {
                method: 'DELETE',
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['logs'] });
        },
    });
}