import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { User } from '@daydone/shared';
import {
  apiFetch,
  clearSession,
  getCurrentUser,
  getStoredRefreshToken,
  onAuthFailure,
  refreshSession,
  setSession,
  setStoredRefreshToken,
  subscribeSession,
} from './api-client';

import { signOutGoogle } from './google-signin';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (serverAuthCode: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sinkronisasi state lokal saat api-client mengubah currentUser
  useEffect(() => {
    return subscribeSession(() => {
      setUser(getCurrentUser());
    });
  }, []);

  // Tangani auth failure (refresh gagal / sesi kedaluwarsa)
  useEffect(() => {
    return onAuthFailure(() => {
      setUser(null);
    });
  }, []);

  // Bootstrap awal: cek apakah ada refresh token tersimpan di SecureStore
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const storedRt = await getStoredRefreshToken();
        if (storedRt) {
          const newAccessToken = await refreshSession();
          if (newAccessToken && isMounted) {
            try {
              const profile = await apiFetch<User>('/auth/me');
              if (isMounted) {
                setSession(newAccessToken, profile);
                setUser(profile);
              }
            } catch {
              // Jika /auth/me gagal, refreshSession sudah menangani clearSession
            }
          }
        }
      } catch {
        // Abaikan error bootstrap, biarkan user di layar login
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginWithGoogle = useCallback(async (serverAuthCode: string) => {
    // Alur pertukaran serverAuthCode dengan backend DayDone (fondasi M8-2)
    const result = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        code: serverAuthCode,
        platform: 'MOBILE',
      }),
      skipAuth: true,
    });

    if (result.refreshToken) {
      await setStoredRefreshToken(result.refreshToken);
    }
    setSession(result.accessToken, result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      const storedRt = await getStoredRefreshToken();
      if (storedRt) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: storedRt }),
          skipAuth: true,
        });
      }
    } catch {
      // Best-effort logout
    } finally {
      await signOutGoogle();
      await clearSession();
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    loginWithGoogle,
    logout,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam <AuthProvider>');
  }
  return context;
}
