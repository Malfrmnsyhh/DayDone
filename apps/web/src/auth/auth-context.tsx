import type { AuthResponse, User } from '@daydone/shared';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  apiFetch,
  clearSession,
  getAccessToken,
  getCurrentUser,
  onAuthFailure,
  refreshSession,
  setSession,
} from '../api/client.js';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Inisialisasi sesi saat aplikasi dimuat pertama kali (Single-flight refresh dari HttpOnly cookie)
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const token = await refreshSession();
        if (token && isMounted) {
          const profile = await apiFetch<User>('/auth/me');
          if (isMounted) {
            setUser(profile);
            setSession(token, profile);
          }
        } else if (isMounted) {
          clearSession();
          setUser(null);
        }
      } catch {
        if (isMounted) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    // Dengarkan event pemutusan sesi jika token kadaluwarsa di tengah jalan
    const unsubscribe = onAuthFailure(() => {
      if (isMounted) {
        setUser(null);
      }
    });

    initAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithCode = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          code,
          platform: 'WEB',
          redirectUri: 'postmessage',
        }),
      });

      setSession(res.accessToken, res.user || null);
      setUser(res.user || null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch {
      // Abaikan error jaringan saat logout
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const profile = await apiFetch<User>('/auth/me');
      setUser(profile);
      setSession(getAccessToken(), profile);
    } catch {
      // Bila gagal memuat profil, biarkan state sesi saat ini
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user && !!getAccessToken(),
    isLoading,
    loginWithCode,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
}

