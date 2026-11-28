import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, User } from '@daydone/shared';
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
import {
  type DriveReconnectOutcome,
  runDriveReconnectFlow,
} from './drive-status';
import { requestGoogleServerAuthCode, signOutGoogle } from './google-signin';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (serverAuthCode: string) => Promise<void>;
  reconnectGoogleDrive: () => Promise<DriveReconnectOutcome>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
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
      queryClient.clear();
      setUser(null);
    });
  }, [queryClient]);

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
    const result = await apiFetch<AuthResponse>('/auth/google', {
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
    const nextUser = result.user ?? null;
    setSession(result.accessToken, nextUser);
    setUser(nextUser);
  }, []);

  const reconnectGoogleDrive =
    useCallback(async (): Promise<DriveReconnectOutcome> => {
      return runDriveReconnectFlow({
        requestAuthCode: () =>
          requestGoogleServerAuthCode({ forcePrompt: true }),
        exchangeCode: (serverAuthCode) =>
          apiFetch<AuthResponse>('/auth/google', {
            method: 'POST',
            body: JSON.stringify({
              code: serverAuthCode,
              platform: 'MOBILE',
            }),
            skipAuth: true,
            // Penting: bila gagal 401 saat rekoneksi, jangan memutus sesi yang sedang aktif
            preserveSessionOn401: true,
          }),
        onConnected: async (result) => {
          if (result.refreshToken) {
            await setStoredRefreshToken(result.refreshToken);
          }
          const nextUser = result.user ?? getCurrentUser();
          setSession(result.accessToken, nextUser);
          setUser(nextUser);
          await queryClient.invalidateQueries({ queryKey: ['logs'] });
        },
      });
    }, [queryClient]);

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
      queryClient.clear();
      setUser(null);
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    loginWithGoogle,
    reconnectGoogleDrive,
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
