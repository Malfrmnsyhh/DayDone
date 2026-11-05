import type { AuthResponse, User } from '@daydone/shared';
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
} from '@daydone/shared';
import { ApiError } from './api-error.js';

// Access token HANYA disimpan di RAM (memori), tidak pernah di localStorage / sessionStorage
let accessToken: string | null = null;
let currentUser: User | null = null;

// Single-flight refresh promise di tingkat modul
let refreshPromise: Promise<string | null> | null = null;

// Subscriber callback saat autentikasi gagal / kedaluwarsa permanen
type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

export function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  return url.replace(/\/$/, '');
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function setSession(token: string | null, user: User | null): void {
  accessToken = token;
  currentUser = user;
}

export function clearSession(): void {
  accessToken = null;
  currentUser = null;
}

export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

function notifyAuthFailure(): void {
  for (const listener of authFailureListeners) {
    listener();
  }
}

/**
 * Eksekusi panggilan HTTP /auth/refresh.
 */
async function executeRefreshNetwork(): Promise<string | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      clearSession();
      notifyAuthFailure();
      return null;
    }

    const data = (await res.json()) as AuthResponse;
    accessToken = data.accessToken;
    if (data.user) {
      currentUser = data.user;
    }
    return data.accessToken;
  } catch {
    clearSession();
    notifyAuthFailure();
    return null;
  }
}

/**
 * Single-flight refresh token:
 * Menjamin hanya ada 1 network request /auth/refresh yang berjalan pada satu waktu di dalam tab.
 * Bila didukung oleh browser, Web Locks API (navigator.locks) digunakan untuk menserialisasi
 * refresh lintas tab agar beberapa tab yang dibuka/refresh bersamaan tidak memicu race condition
 * atau reuse detection; tab berikutnya akan menggunakan cookie yang telah dirotasi oleh tab sebelumnya.
 */
export async function refreshSession(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        'locks' in navigator &&
        typeof navigator.locks?.request === 'function'
      ) {
        return await navigator.locks.request('daydone-refresh', () =>
          executeRefreshNetwork(),
        );
      }
      return await executeRefreshNetwork();
    } catch {
      clearSession();
      notifyAuthFailure();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  isRetry?: boolean;
}

/**
 * Fetch wrapper utama DayDone API.
 * Menangani injeksi token otomatis, proteksi CSRF, credentials cookie,
 * penanganan 401 auto-retry single flight, dan parsing ApiError.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { headers = {}, skipAuth = false, isRetry = false, ...restOptions } = options;

  const url = path.startsWith('http')
    ? path
    : `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

  const isAuthEndpoint = path.includes('/auth/');
  const isCsrfProtectedEndpoint =
    path.endsWith('/auth/refresh') || path.endsWith('/auth/logout');

  const requestHeaders: Record<string, string> = { ...headers };

  // Set Content-Type JSON bila body bukan FormData
  if (!(restOptions.body instanceof FormData) && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // Sertakan Authorization header dari memori bila tersedia
  if (accessToken && !skipAuth) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  // Sertakan header proteksi CSRF untuk endpoint sensitif auth
  if (isCsrfProtectedEndpoint) {
    requestHeaders[CSRF_HEADER_NAME] = CSRF_HEADER_VALUE;
  }

  // Rute auth wajib credentials: 'include' untuk cookie daydone_rt
  const credentials = isAuthEndpoint ? 'include' : restOptions.credentials || 'same-origin';

  const res = await fetch(url, {
    ...restOptions,
    credentials,
    headers: requestHeaders,
  });

  // Tangani 401 Unauthorized
  if (res.status === 401) {
    // Jangan refresh jika 401 berasal dari endpoint refresh, login, atau request retry
    if (isAuthEndpoint || isRetry) {
      const errData = await parseErrorPayload(res);
      clearSession();
      throw new ApiError({ ...errData, statusCode: 401 });
    }

    // Coba refresh token sesi (single-flight)
    const newToken = await refreshSession();
    if (newToken) {
      // Ulangi request tepat sekali dengan token baru
      return apiFetch<T>(path, { ...options, isRetry: true });
    }

    // Refresh gagal -> buang sesi dan lempar error
    clearSession();
    notifyAuthFailure();
    throw new ApiError({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Sesi telah berakhir. Silakan login kembali.',
      code: 'SESSION_EXPIRED',
    });
  }

  // Tangani error non-2xx selain 401
  if (!res.ok) {
    const errData = await parseErrorPayload(res);
    throw new ApiError({ ...errData, statusCode: res.status });
  }

  // Response kosong (204 No Content)
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

async function parseErrorPayload(res: Response): Promise<{
  error?: string;
  message?: string | string[];
  code?: any;
  existingLogId?: string;
}> {
  try {
    return await res.json();
  } catch {
    return {
      error: res.statusText || 'Error',
      message: res.statusText || `Request gagal dengan status ${res.status}`,
    };
  }
}

