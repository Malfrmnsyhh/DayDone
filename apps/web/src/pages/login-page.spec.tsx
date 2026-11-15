import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestWrapper } from '../test/test-utils.js';
import { LoginPage } from './login-page.js';

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { google?: unknown }).google;
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
  });

  it('menampilkan elemen branding, heading, panduan izin Drive, dan tombol login', () => {
    render(
      <TestWrapper authValue={{ isAuthenticated: false, user: null }}>
        <LoginPage />
      </TestWrapper>,
    );

    expect(screen.getByText('DD')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'DayDone' })).toBeInTheDocument();
    expect(
      screen.getByText(/Logbook harian mahasiswa magang — rapi, cepat, dan aman/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Masuk ke Akun Anda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk dengan Google/i })).toBeInTheDocument();
    expect(screen.getByText(/Akses Aman & Terbatas:/i)).toBeInTheDocument();
    expect(screen.getByText(/drive\.file/i)).toBeInTheDocument();
  });

  it('menampilkan pesan error role="alert" bila VITE_GOOGLE_WEB_CLIENT_ID belum diset', () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', '');

    render(
      <TestWrapper authValue={{ isAuthenticated: false, user: null }}>
        <LoginPage />
      </TestWrapper>,
    );

    const button = screen.getByRole('button', { name: /Masuk dengan Google/i });
    fireEvent.click(button);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Konfigurasi VITE_GOOGLE_WEB_CLIENT_ID belum diatur');
  });

  it('menampilkan pesan error bila library Google Identity Services belum termuat', () => {
    render(
      <TestWrapper authValue={{ isAuthenticated: false, user: null }}>
        <LoginPage />
      </TestWrapper>,
    );

    const button = screen.getByRole('button', { name: /Masuk dengan Google/i });
    fireEvent.click(button);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Google Identity Services belum siap atau koneksi terhambat');
  });

  it('menginisialisasi Google code client dan memanggil loginWithCode saat otorisasi berhasil', async () => {
    const loginWithCodeMock = vi.fn().mockResolvedValue(undefined);
    let capturedCallback: ((resp: { code?: string; error?: string }) => Promise<void>) | undefined;
    const requestCodeMock = vi.fn();

    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn().mockImplementation((config) => {
            capturedCallback = config.callback;
            return {
              requestCode: requestCodeMock,
            };
          }),
        },
      },
    };

    render(
      <TestWrapper
        authValue={{
          isAuthenticated: false,
          user: null,
          loginWithCode: loginWithCodeMock,
        }}
      >
        <LoginPage />
      </TestWrapper>,
    );

    const button = screen.getByRole('button', { name: /Masuk dengan Google/i });
    fireEvent.click(button);

    expect(requestCodeMock).toHaveBeenCalledTimes(1);
    expect(capturedCallback).toBeDefined();

    // Simulasikan Google popup mengembalikan auth code
    await act(async () => {
      await capturedCallback!({ code: 'fake-auth-code-123' });
    });

    expect(loginWithCodeMock).toHaveBeenCalledWith('fake-auth-code-123');
  });

  it('menangani error callback saat jendela popup Google ditutup oleh pengguna', () => {
    let capturedErrorCallback: (() => void) | undefined;

    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn().mockImplementation((config) => {
            capturedErrorCallback = config.error_callback;
            return {
              requestCode: vi.fn(),
            };
          }),
        },
      },
    };

    render(
      <TestWrapper authValue={{ isAuthenticated: false, user: null }}>
        <LoginPage />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Masuk dengan Google/i }));
    expect(capturedErrorCallback).toBeDefined();

    act(() => {
      capturedErrorCallback!();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Jendela popup Google ditutup atau dibatalkan');
  });

  it('menampilkan pesan error saat izin otorisasi Google ditolak', () => {
    let capturedCallback: ((resp: { code?: string; error?: string }) => Promise<void>) | undefined;

    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn().mockImplementation((config) => {
            capturedCallback = config.callback;
            return {
              requestCode: vi.fn(),
            };
          }),
        },
      },
    };

    render(
      <TestWrapper authValue={{ isAuthenticated: false, user: null }}>
        <LoginPage />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Masuk dengan Google/i }));

    act(() => {
      capturedCallback!({ error: 'access_denied' });
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Izin otorisasi ditolak: access_denied');
  });

  it('menampilkan pesan error saat loginWithCode gagal/melempar error', async () => {
    const loginWithCodeMock = vi.fn().mockRejectedValue(new Error('Server auth error'));
    let capturedCallback: ((resp: { code?: string; error?: string }) => Promise<void>) | undefined;

    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn().mockImplementation((config) => {
            capturedCallback = config.callback;
            return {
              requestCode: vi.fn(),
            };
          }),
        },
      },
    };

    render(
      <TestWrapper
        authValue={{
          isAuthenticated: false,
          user: null,
          loginWithCode: loginWithCodeMock,
        }}
      >
        <LoginPage />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Masuk dengan Google/i }));

    await act(async () => {
      await capturedCallback!({ code: 'valid-code' });
    });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Server auth error');
    });
  });
});
