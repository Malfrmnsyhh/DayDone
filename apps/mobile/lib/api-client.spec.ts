import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import {
  ApiError,
  apiFetch,
  clearSession,
  getAccessToken,
  onAuthFailure,
  REFRESH_TOKEN_STORAGE_KEY,
  setAccessToken,
} from './api-client';

vi.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: vi.fn(async (key: string) => store[key] ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      delete store[key];
    }),
    __resetStore: () => {
      store = {};
    },
  };
});

describe('api-client (mobile)', () => {
  const mockFetch = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    (SecureStore as any).__resetStore();
    await clearSession();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Injeksi token', () => {
    it('menyertakan header Authorization: Bearer <token> bila token tersimpan di memori', async () => {
      setAccessToken('token-akses-123');
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
      );

      await apiFetch('/logs');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/logs',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token-akses-123',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('tidak menyertakan header Authorization bila skipAuth bernilai true', async () => {
      setAccessToken('token-akses-123');
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
      );

      await apiFetch('/health', { skipAuth: true });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('Auto-refresh single-flight saat 401', () => {
    it('merotasi refresh token dan mengulang request saat terjadi 401', async () => {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_STORAGE_KEY,
        'refresh-token-lama',
      );
      setAccessToken('token-akses-kedaluwarsa');

      // 1. Panggilan /logs pertama gagal 401
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 401, message: 'Token expired' }),
          { status: 401 },
        ),
      );

      // 2. Panggilan /auth/refresh berhasil dengan token baru
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'token-akses-baru',
            accessTokenExpiresAt: '2026-11-14T10:00:00.000Z',
            refreshToken: 'refresh-token-baru',
            user: { id: 'u1', email: 'test@daydone.app' },
          }),
          { status: 200 },
        ),
      );

      // 3. Panggilan /logs retry berhasil
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      const result = await apiFetch<{ success: boolean }>('/logs');

      expect(result).toEqual({ success: true });
      expect(getAccessToken()).toBe('token-akses-baru');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        REFRESH_TOKEN_STORAGE_KEY,
        'refresh-token-baru',
      );

      // Cek bahwa /auth/refresh dipanggil dengan body { refreshToken: 'refresh-token-lama' }
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3000/api/v1/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'refresh-token-lama' }),
        }),
      );

      // Cek bahwa request retry memakai Authorization baru
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        'http://localhost:3000/api/v1/logs',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token-akses-baru',
          }),
        }),
      );
    });

    it('memastikan refresh bersifat single-flight saat banyak request mendapat 401 bersamaan', async () => {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_STORAGE_KEY,
        'refresh-token-shared',
      );
      setAccessToken('token-kedaluwarsa');

      // Request A & B keduanya membalas 401 pada request awal, lalu sukses pada retry
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        const authHeader = (init?.headers as any)?.Authorization;
        if (authHeader === 'Bearer token-hasil-refresh-tunggal') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url.endsWith('/logs/a') || url.endsWith('/logs/b')) {
          return new Response(JSON.stringify({ error: 'Expired' }), {
            status: 401,
          });
        }
        if (url.endsWith('/auth/refresh')) {
          // Beri sedikit jeda mikro
          await new Promise((r) => setTimeout(r, 10));
          return new Response(
            JSON.stringify({
              accessToken: 'token-hasil-refresh-tunggal',
              refreshToken: 'refresh-token-baru',
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const [resA, resB] = await Promise.all([
        apiFetch<{ ok: boolean }>('/logs/a'),
        apiFetch<{ ok: boolean }>('/logs/b'),
      ]);

      expect(resA).toEqual({ ok: true });
      expect(resB).toEqual({ ok: true });

      // Verifikasi endpoint /auth/refresh HANYA dipanggil tepat SATU kali (single-flight)
      const refreshCalls = mockFetch.mock.calls.filter((c) =>
        c[0].endsWith('/auth/refresh'),
      );
      expect(refreshCalls).toHaveLength(1);
    });
  });

  describe('Refresh gagal -> sesi dibersihkan', () => {
    it('membersihkan sesi di RAM dan SecureStore serta memicu onAuthFailure bila refresh gagal 401', async () => {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_STORAGE_KEY,
        'refresh-token-invalid',
      );
      setAccessToken('token-lama');

      const authFailureListener = vi.fn();
      const unsubscribe = onAuthFailure(authFailureListener);

      // 1. Request awal 401
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Token expired' }), {
          status: 401,
        }),
      );

      // 2. Refresh gagal 401 (mis. SESSION_EXPIRED)
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 401,
            code: 'SESSION_EXPIRED',
            message: 'Refresh token invalid',
          }),
          { status: 401 },
        ),
      );

      await expect(apiFetch('/logs')).rejects.toThrow(ApiError);

      expect(getAccessToken()).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        REFRESH_TOKEN_STORAGE_KEY,
      );
      expect(authFailureListener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('tidak mencoba refresh jika endpoint adalah rute auth non-refreshable seperti /auth/google', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 401,
            code: 'GOOGLE_AUTH_FAILED',
            message: 'Code invalid',
          }),
          { status: 401 },
        ),
      );

      await expect(
        apiFetch('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ code: 'bad-code' }),
        }),
      ).rejects.toThrow(ApiError);

      // Pastikan /auth/refresh sama sekali tidak pernah dipanggil
      const refreshCalls = mockFetch.mock.calls.filter((c) =>
        c[0].endsWith('/auth/refresh'),
      );
      expect(refreshCalls).toHaveLength(0);
    });

    it('mempertahankan sesi aktif bila preserveSessionOn401 bernilai true saat rekoneksi Drive gagal 401', async () => {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_STORAGE_KEY,
        'refresh-token-aktif',
      );
      setAccessToken('access-token-aktif');
      vi.mocked(SecureStore.deleteItemAsync).mockClear();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 401,
            code: 'GOOGLE_AUTH_FAILED',
            message: 'Code tidak valid',
          }),
          { status: 401 },
        ),
      );

      await expect(
        apiFetch('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ code: 'bad-reconnect-code', platform: 'MOBILE' }),
          skipAuth: true,
          preserveSessionOn401: true,
        }),
      ).rejects.toThrow(ApiError);

      // Sesi aktif tidak boleh terhapus saat rekoneksi Drive gagal
      expect(getAccessToken()).toBe('access-token-aktif');
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
      expect(
        await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY),
      ).toBe('refresh-token-aktif');
    });

    it('langsung membersihkan sesi bila terjadi 401 tetapi refresh token tidak ada di SecureStore', async () => {
      setAccessToken('token-tanpa-refresh');

      const authFailureListener = vi.fn();
      const unsubscribe = onAuthFailure(authFailureListener);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
        }),
      );

      await expect(apiFetch('/logs')).rejects.toThrow(ApiError);

      expect(getAccessToken()).toBeNull();
      expect(authFailureListener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });

  describe('Penanganan response dan domain error', () => {
    it('mengembalikan undefined bila response berstatus 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      const result = await apiFetch<void>('/auth/logout', { method: 'POST' });
      expect(result).toBeUndefined();
    });

    it('memetakan kode error domain dan pesan error ke ApiError', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 409,
            error: 'Conflict',
            code: 'LOG_DATE_CONFLICT',
            message: 'Logbook untuk tanggal 2026-11-02 sudah ada',
            existingLogId: 'log-123',
          }),
          { status: 409 },
        ),
      );

      try {
        await apiFetch('/logs', { method: 'POST' });
        expect.fail('Harus melempar ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(409);
        expect(apiErr.code).toBe('LOG_DATE_CONFLICT');
        expect(apiErr.existingLogId).toBe('log-123');
      }
    });
  });
});
