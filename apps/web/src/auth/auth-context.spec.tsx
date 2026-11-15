import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, setSession } from '../api/client.js';
import { AuthProvider, useAuth } from './auth-context.js';

function TestConsumer() {
  const { isAuthenticated, user, isLoading, logout } = useAuth();

  if (isLoading) {
    return <div data-testid="loading">LOADING</div>;
  }

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>
      <div data-testid="user-email">{user?.email ?? 'NO_USER'}</div>
      <button onClick={() => logout()} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
}

describe('AuthContext reactivity', () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      }),
    );
  });

  afterEach(() => {
    act(() => {
      clearSession();
    });
  });

  it('status isAuthenticated berubah secara reaktif saat token dibersihkan (clearSession)', () => {
    setSession('token-123', {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User Test',
      avatarUrl: null,
      driveStatus: 'CONNECTED',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user-email')).toHaveTextContent('user@example.com');

    // Sesi dibersihkan (misal via clearSession saat 401 atau reset token)
    act(() => {
      clearSession();
    });

    // UI langsung bereaksi menjadi ANONYMOUS
    expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
    expect(screen.getByTestId('user-email')).toHaveTextContent('NO_USER');
  });

  it('status isAuthenticated berubah secara reaktif saat setSession dipanggil', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Tunggu bootstrap inisialisasi selesai dan tampil state anonim
    expect(await screen.findByTestId('auth-status')).toHaveTextContent('ANONYMOUS');

    // Tetapkan sesi baru secara dinamis
    act(() => {
      setSession('token-dynamic', {
        id: 'user-dynamic',
        email: 'dynamic@example.com',
        name: 'Dynamic User',
        avatarUrl: null,
        driveStatus: 'CONNECTED',
      });
    });

    // UI langsung menjadi AUTHENTICATED
    expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user-email')).toHaveTextContent('dynamic@example.com');
  });

  it('logout() membersihkan sesi dan mengubah status isAuthenticated menjadi false', async () => {
    setSession('token-logout', {
      id: 'user-logout',
      email: 'logout@example.com',
      name: 'Logout User',
      avatarUrl: null,
      driveStatus: 'CONNECTED',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
    expect(screen.getByTestId('user-email')).toHaveTextContent('NO_USER');
  });

  it('berpindah ke status terotentikasi setelah bootstrap refresh berhasil', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'token-bootstrapped',
          }),
        };
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user-bootstrapped',
            email: 'bootstrapped@example.com',
            name: 'Bootstrapped User',
            avatarUrl: null,
            driveStatus: 'CONNECTED',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user-email')).toHaveTextContent('bootstrapped@example.com');
  });
});
