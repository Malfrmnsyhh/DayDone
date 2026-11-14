import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  clearSession,
  getAccessToken,
  getCurrentUser,
  onAuthFailure,
  refreshSession,
  setSession,
  subscribeAccessToken,
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

  it('REFRESH LINTAS TAB: menggunakan navigator.locks.request("daydone-refresh") bila didukung browser', async () => {
    const requestMock = vi.fn().mockImplementation(async (_name: string, cb: () => Promise<unknown>) => {
      return await cb();
    });

    vi.stubGlobal('navigator', {
      ...navigator,
      locks: {
        request: requestMock,
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'token-from-web-lock',
        user: { id: 'u1', email: 'u1@test.com', name: 'U1', avatarUrl: null, driveStatus: 'CONNECTED' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await refreshSession();

    expect(requestMock).toHaveBeenCalledWith('daydone-refresh', expect.any(Function));
    expect(token).toBe('token-from-web-lock');
    expect(getAccessToken()).toBe('token-from-web-lock');
  });

  it('REFRESH LINTAS TAB: antrean Web Locks menserialisasi refresh agar berjalan berurutan', async () => {
    let isLocked = false;
    const executionOrder: string[] = [];

    const requestMock = vi.fn().mockImplementation(async (_name: string, cb: () => Promise<unknown>) => {
      while (isLocked) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      isLocked = true;
      try {
        return await cb();
      } finally {
        isLocked = false;
      }
    });

    vi.stubGlobal('navigator', {
      locks: { request: requestMock },
    });

    let refreshIdx = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      refreshIdx++;
      const current = refreshIdx;
      executionOrder.push(`start-${current}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
      executionOrder.push(`end-${current}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: `token-${current}`,
          user: { id: 'u1', email: 'u1@test.com', name: 'U1', avatarUrl: null, driveStatus: 'CONNECTED' },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    // Tab 1 memanggil refreshSession()
    const p1 = refreshSession();
    // Simulasi Tab 2 (instance tab terpisah yang antre pada lock yang sama)
    const p2 = navigator.locks.request('daydone-refresh', async () => {
      return await fetchMock();
    });

    await Promise.all([p1, p2]);

    // Tab 1 selesai sebelum Tab 2 mulai mengeksekusi fetch
    expect(executionOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('REFRESH FALLBACK: tetap berfungsi normal bila navigator.locks tidak tersedia', async () => {
    vi.stubGlobal('navigator', {});

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'token-no-locks',
        user: { id: 'u1', email: 'u1@test.com', name: 'U1', avatarUrl: null, driveStatus: 'CONNECTED' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await refreshSession();
    expect(token).toBe('token-no-locks');
    expect(getAccessToken()).toBe('token-no-locks');
  });

  it('401 di /auth/me memicu refresh dan mengulangi request dengan token baru', async () => {
    let refreshCalls = 0;
    let meCalls = 0;

    const fetchMock = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'token-refreshed-for-me',
            user: {
              id: 'u1',
              email: 'test@example.com',
              name: 'User Test',
              avatarUrl: null,
              driveStatus: 'CONNECTED',
            },
          }),
        };
      }

      if (url.includes('/auth/me')) {
        meCalls++;
        if (options?.headers?.Authorization !== 'Bearer token-refreshed-for-me') {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized', message: 'Token expired' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u1',
            email: 'test@example.com',
            name: 'User Test',
            avatarUrl: null,
            driveStatus: 'CONNECTED',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);
    setSession('old-expired-token', null);

    const user = await apiFetch<{ id: string; email: string }>('/auth/me');

    expect(meCalls).toBe(2); // 1 kali gagal 401 + 1 kali retry berhasil
    expect(refreshCalls).toBe(1);
    expect(user.email).toBe('test@example.com');
    expect(getAccessToken()).toBe('token-refreshed-for-me');
  });

  it('PARALEL 401 /auth/me: pemanggilan /auth/me paralel yang kena 401 hanya memicu 1 kali refresh', async () => {
    let refreshCalls = 0;
    let meCalls = 0;

    const fetchMock = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'token-parallel-me',
            user: {
              id: 'u1',
              email: 'parallel@example.com',
              name: 'Parallel User',
              avatarUrl: null,
              driveStatus: 'CONNECTED',
            },
          }),
        };
      }

      if (url.includes('/auth/me')) {
        meCalls++;
        if (options?.headers?.Authorization !== 'Bearer token-parallel-me') {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized', message: 'Token expired' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'u1', email: 'parallel@example.com', name: 'Parallel User' }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);
    setSession('old-expired-token', null);

    const [user1, user2] = await Promise.all([
      apiFetch<{ id: string; email: string }>('/auth/me'),
      apiFetch<{ id: string; email: string }>('/auth/me'),
    ]);

    expect(refreshCalls).toBe(1); // Tepat 1 kali refresh untuk kedua request paralel
    expect(meCalls).toBe(4); // 2 kali gagal 401 + 2 kali retry berhasil
    expect(user1.id).toBe('u1');
    expect(user2.id).toBe('u1');
  });

  it('401 di /auth/me: memicu notifyAuthFailure bila retry tetap gagal 401', async () => {
    const authFailureSpy = vi.fn();
    const unsub = onAuthFailure(authFailureSpy);

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ accessToken: 'new-token' }),
        };
      }
      if (url.includes('/auth/me')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized', message: 'Still invalid' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);
    setSession('old-token', null);

    await expect(apiFetch('/auth/me')).rejects.toThrow();

    expect(authFailureSpy).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    unsub();
  });

  it('401 di /auth/refresh tidak memicu loop refresh dan langsung membersihkan sesi', async () => {
    let refreshCalls = 0;

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: 'Unauthorized',
            message: 'Refresh token invalid or expired',
            code: 'SESSION_EXPIRED',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);
    setSession('some-token', {
      id: 'u1',
      email: 'test@example.com',
      name: 'Test',
      avatarUrl: null,
      driveStatus: 'CONNECTED',
    });

    await expect(apiFetch('/auth/refresh', { method: 'POST' })).rejects.toThrow();

    // Pastikan tidak ada loop / rekursi refresh; fetch hanya dipanggil tepat 1 kali
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it('401 di /auth/google dan /auth/logout tidak mencoba refresh', async () => {
    let refreshCalls = 0;
    let googleCalls = 0;
    let logoutCalls = 0;

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        return { ok: true, status: 200, json: async () => ({ accessToken: 'new-token' }) };
      }
      if (url.includes('/auth/google')) {
        googleCalls++;
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized', code: 'GOOGLE_AUTH_FAILED' }),
        };
      }
      if (url.includes('/auth/logout')) {
        logoutCalls++;
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({}) }),
    ).rejects.toThrow();
    await expect(
      apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
    ).rejects.toThrow();

    expect(googleCalls).toBe(1);
    expect(logoutCalls).toBe(1);
    expect(refreshCalls).toBe(0); // Sama sekali tidak memicu refresh
  });

  it('request /auth/google menyertakan credentials: "include" untuk alur reconnect Drive', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'new-google-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ code: 'auth-code', platform: 'WEB', redirectUri: 'postmessage' }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe('include');
  });

  it('subscribeAccessToken memberi tahu listener saat setSession dan clearSession dipanggil', () => {
    const listener = vi.fn();
    const unsub = subscribeAccessToken(listener);

    setSession('token-abc', {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
      driveStatus: 'CONNECTED',
    });

    expect(listener).toHaveBeenCalledTimes(1);

    clearSession();
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    setSession('token-xyz', null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
