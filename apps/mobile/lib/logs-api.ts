import type {
  CreateLogDto,
  Log,
  LogListItem,
  LogStats,
  Paginated,
  UpdateLogDto,
} from "@daydone/shared";
import {
  createLogSchema,
  ErrorCode,
  getErrorMessage,
  SIGNED_URL_TTL_SECONDS,
} from "@daydone/shared";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, apiFetch } from "./api-client";
import { getTodayLocalDateString, isValidDateString } from "./date";

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

export interface LogDateConflictInfo {
  message: string;
  existingLogId: string | null;
}

/**
 * Mengekstrak informasi konflik tanggal (409 LOG_DATE_CONFLICT) beserta existingLogId.
 * Mengembalikan null bila error bukan konflik tanggal.
 */
export const getLogDateConflict = (
  error: unknown,
): LogDateConflictInfo | null => {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const isConflict =
    error.code === ErrorCode.LOG_DATE_CONFLICT ||
    (error.statusCode === 409 && Boolean(error.existingLogId));

  if (!isConflict) {
    return null;
  }

  return {
    message:
      error.message || getErrorMessage(ErrorCode.LOG_DATE_CONFLICT),
    existingLogId: error.existingLogId ?? null,
  };
};

export interface LogFormValidationErrors {
  date?: string;
  description?: string;
}

export type LogFormValidationResult =
  | { valid: true; data: CreateLogDto }
  | { valid: false; errors: LogFormValidationErrors };

/**
 * Memvalidasi input form logbook dengan aturan tanggal lokal (<= today)
 * serta skema Zod dari @daydone/shared sebagai single source of truth.
 */
export const validateLogFormInput = (
  input: { date: string; description: string },
  today: string = getTodayLocalDateString(),
): LogFormValidationResult => {
  const errors: LogFormValidationErrors = {};
  const trimmedDate = input.date.trim();

  if (!isValidDateString(trimmedDate)) {
    errors.date = "Format tanggal harus YYYY-MM-DD yang valid (contoh: 2026-11-28)";
  } else if (trimmedDate > today) {
    errors.date = "Tanggal logbook tidak boleh melebihi hari ini";
  }

  const parsed = createLogSchema.safeParse({
    date: isValidDateString(trimmedDate) ? trimmedDate : today,
    description: input.description,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "date" && !errors.date) {
        errors.date = issue.message;
      } else if (field === "description" && !errors.description) {
        errors.description = issue.message;
      }
    }
  }

  if (errors.date || errors.description || !parsed.success) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      date: trimmedDate,
      description: parsed.data.description,
    },
  };
};

/**
 * Menentukan tanggal awal form dari query param opsional `?date=YYYY-MM-DD`.
 * Jatuh kembali ke `today` bila parameter kosong, tidak valid, atau melebihi hari ini.
 */
export const resolveInitialFormDate = (
  requestedDate: string | string[] | undefined,
  today: string = getTodayLocalDateString(),
): string => {
  const candidate = Array.isArray(requestedDate)
    ? requestedDate[0]
    : requestedDate;

  if (candidate && isValidDateString(candidate) && candidate <= today) {
    return candidate;
  }

  return today;
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
 * Membuat logbook baru (POST /logs) dan menginvalidasi seluruh cache ['logs']
 * agar Beranda, Statistik bulanan, dan Daftar otomatis sinkron.
 */
export const useCreateLog = () => {
  const queryClient = useQueryClient();

  return useMutation<Log, Error, CreateLogDto>({
    mutationFn: (dto) =>
      apiFetch<Log>("/logs", {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
};

export interface UpdateLogVariables {
  id: string;
  dto: UpdateLogDto;
}

/**
 * Memperbarui tanggal dan/atau deskripsi logbook (PATCH /logs/:id)
 * lalu menginvalidasi seluruh cache ['logs'].
 */
export const useUpdateLog = () => {
  const queryClient = useQueryClient();

  return useMutation<Log, Error, UpdateLogVariables>({
    mutationFn: ({ id, dto }) =>
      apiFetch<Log>(`/logs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
};

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
};