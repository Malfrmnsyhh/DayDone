import type { AuthResponse, User } from '@daydone/shared';
import { getErrorMessage } from '@daydone/shared';
import * as SecureStore from 'expo-secure-store';

export const REFRESH_TOKEN_STORAGE_KEY = 'daydone_mobile_rt';

// Access token HANYA disimpan di RAM (memori), tidak pernah disimpan di disk/storage
let accessToken: string | null = null;
let currentUser: User | null = null;

// Single-flight refresh promise agar tidak ada panggilan refresh ganda paralel
let refreshPromise: Promise<string | null> | null = null;

// Listener kegagalan autentikasi (sesi berakhir permanen -> redirect ke login)
type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

// Listener perubahan sesi (reaktivitas UI)
type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly originalError?: string;
  public readonly validationMessages?: string[];
  public readonly existingLogId?: string;

  constructor(params: {
    statusCode: number;
    error?: string;
    message?: string | string[];
    code?: string;
    existingLogId?: string;
  }) {
    let msg: string;
    if (Array.isArray(params.message)) {
      msg = params.message.join(', ');
    } else if (params.code) {
      msg = getErrorMessage(params.code, params.message);
    } else {
      msg = params.message || params.error || 'Terjadi kesalahan sistem';
    }

    super(msg);
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.originalError = params.error;
    this.existingLogId = params.existingLogId;

    if (Array.isArray(params.message)) {
      this.validationMessages = params.message;
    }
  }
}

export function getBaseUrl(): string {
  const url =
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  return url.replace(/\/$/, '');
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredRefreshToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage write errors in restricted environments
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  notifySessionChange();
}

export function setSession(token: string | null, user: User | null): void {
  accessToken = token;
  currentUser = user;
  notifySessionChange();
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  currentUser = null;
  await setStoredRefreshToken(null);
  notifySessionChange();
}

export function subscribeSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function notifySessionChange(): void {
  for (const listener of sessionListeners) {
    listener();
  }
}

function notifyAuthFailure(): void {
  for (const listener of authFailureListeners) {
    listener();
  }
}

/**
 * Eksekusi panggilan HTTP /auth/refresh untuk platform MOBILE.
 * Mengirimkan { refreshToken } di body JSON dan menyimpan refresh token baru hasil rotasi.
 */
async function executeRefreshNetwork(): Promise<string | null> {
  try {
    const storedRt = await getStoredRefreshToken();
    if (!storedRt) {
      await clearSession();
      notifyAuthFailure();
      return null;
    }

    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: storedRt }),
    });

    if (!res.ok) {
      await clearSession();
      notifyAuthFailure();
      return null;
    }

    const data = (await res.json()) as AuthResponse;
    const nextUser = data.user ?? currentUser;
    setSession(data.accessToken, nextUser);

    // Pada platform MOBILE, backend merotasi refreshToken dan mengirimkannya di body
    if (data.refreshToken) {
      await setStoredRefreshToken(data.refreshToken);
    }

    return data.accessToken;
  } catch {
    await clearSession();
    notifyAuthFailure();
    return null;
  }
}

/**
 * Single-flight refresh token:
 * Menjamin hanya ada 1 request /auth/refresh yang berjalan pada satu waktu di aplikasi mobile.
 */
export async function refreshSession(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      return await executeRefreshNetwork();
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

function isNonRefreshableAuthEndpoint(path: string): boolean {
  const cleanPath = path.split('?')[0].replace(/\/$/, '');
  return (
    cleanPath.endsWith('/auth/google') ||
    cleanPath.endsWith('/auth/refresh') ||
    cleanPath.endsWith('/auth/logout')
  );
}

/**
 * Fetch wrapper utama untuk DayDone API di mobile.
 * Menangani injeksi access token, single-flight auto-refresh saat 401,
 * rotasi refresh token di SecureStore, dan translasi ApiError.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { headers = {}, skipAuth = false, isRetry = false, ...restOptions } = options;

  const url = path.startsWith('http')
    ? path
    : `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

  const requestHeaders: Record<string, string> = { ...headers };

  // Set Content-Type JSON bila body bukan FormData
  if (!(restOptions.body instanceof FormData) && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // Sertakan Authorization header dari memori bila tersedia
  if (accessToken && !skipAuth) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
  });

  // Tangani 401 Unauthorized
  if (res.status === 401) {
    // Jangan refresh jika 401 berasal dari endpoint non-refreshable
    if (isNonRefreshableAuthEndpoint(path)) {
      const errData = await parseErrorPayload(res);
      await clearSession();
      throw new ApiError({ ...errData, statusCode: 401 });
    }

    // Bila pemanggilan retry tetap gagal 401, bersihkan sesi dan beri tahu failure
    if (isRetry) {
      const errData = await parseErrorPayload(res);
      await clearSession();
      notifyAuthFailure();
      throw new ApiError({ ...errData, statusCode: 401 });
    }

    // Coba refresh token sesi (single-flight)
    const newToken = await refreshSession();
    if (newToken) {
      // Ulangi request tepat satu kali dengan token baru
      return apiFetch<T>(path, { ...options, isRetry: true });
    }

    // Refresh gagal (sesi dan notifikasi failure sudah ditangani oleh executeRefreshNetwork) -> lempar error
    throw new ApiError({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
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
  code?: string;
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
