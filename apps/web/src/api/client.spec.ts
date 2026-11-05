import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  clearSession,
  getAccessToken,
  getCurrentUser,
  refreshSession,
  setSession,
} from './client.js';

describe('API Client (apps/web)', () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearSession();
  });

  it('menyimpan dan menghapus token hanya di memori', () => {
    expect(getAccessToken()).toBeNull();
    setSession('jwt-access-token-123', {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User Test',
      avatarUrl: null,
      driveStatus: 'CONNECTED',
    });

    expect(getAccessToken()).toBe('jwt-access-token-123');
    expect(getCurrentUser()?.email).toBe('user@example.com');

    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it('menyertakan header CSRF X-Requested-With untuk /auth/refresh dan /auth/logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'new-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/auth/refresh', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['X-Requested-With']).toBe('daydone-web');
    expect(options.credentials).toBe('include');
  });

  it('SINGLE-FLIGHT REFRESH: dua pemanggilan bootstrap refresh bersamaan memicu tepat 1 fetch', async () => {
    let fetchCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      fetchCount++;
      // Simulasi jeda network
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'refreshed-token-xyz',
          user: {
            id: 'u-1',
            email: 'test@example.com',
            name: 'Test',
            avatarUrl: null,
            driveStatus: 'CONNECTED',
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    // Dua panggilan bootstrap bersamaan (seperti React StrictMode mount ganda)
    const [token1, token2] = await Promise.all([
      refreshSession(),
      refreshSession(),
    ]);

    expect(fetchCount).toBe(1);
    expect(token1).toBe('refreshed-token-xyz');
    expect(token2).toBe('refreshed-token-xyz');
    expect(getAccessToken()).toBe('refreshed-token-xyz');
  });

  it('AUTO-RETRY SINGLE FLIGHT: 3 request paralel yang kena 401 memicu tepat 1 refresh', async () => {
    let refreshCalls = 0;
    let dataCalls = 0;

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'token-after-refresh',
            user: { id: 'u1', email: 'u1@test.com', name: 'U1', avatarUrl: null, driveStatus: 'CONNECTED' },
          }),
        };
      }

      if (url.includes('/logs')) {
        dataCalls++;
        // Bila belum punya token baru, kembalikan 401
        if (getAccessToken() !== 'token-after-refresh') {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized', message: 'Token expired' }),
          };
        }
        // Jika sudah di-refresh, kembalikan 200 data
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'log-1' }] }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);
    setSession('old-expired-token', null);

    // Tiga request data paralel saat token kedaluwarsa
    const results = await Promise.all([
      apiFetch<{ data: unknown[] }>('/logs?page=1'),
      apiFetch<{ data: unknown[] }>('/logs?page=2'),
      apiFetch<{ data: unknown[] }>('/logs?page=3'),
    ]);

    // Tepat 1 pemanggilan refresh network!
    expect(refreshCalls).toBe(1);
    expect(dataCalls).toBeGreaterThanOrEqual(3);
    expect(getAccessToken()).toBe('token-after-refresh');

    // Masing-masing request berhasil mendapatkan data setelah retry
    expect(results[0].data).toEqual([{ id: 'log-1' }]);
    expect(results[1].data).toEqual([{ id: 'log-1' }]);
    expect(results[2].data).toEqual([{ id: 'log-1' }]);
  });
});
