import type { Log, LogStats } from '@daydone/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from './api-client';

/**
 * Mengambil logbook untuk tanggal tertentu (YYYY-MM-DD), misalnya hari ini.
 * Jika backend membalas 404 (belum diisi), kembalikan null agar UI mudah
 * membedakan antara "belum diisi" vs "error jaringan/server".
 */
export function useLogByDate(date: string) {
    return useQuery<Log | null>({
        queryKey: ['logs', 'by-date', date],
        queryFn: async () => {
            try {
                return await apiFetch<Log>(`/logs/by-date/${date}`);
            } catch (error: unknown) {
                if (error instanceof ApiError && error.statusCode === 404) {
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
        queryKey: ['logs', 'stats', month],
        queryFn: () => 
            apiFetch<LogStats>(`/logs/stats?month=${encodeURIComponent(month)}`),
    })
}