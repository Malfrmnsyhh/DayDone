import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultMockUser, TestWrapper } from '../test/test-utils.js';
import { SettingsPage } from './settings-page.js';

describe('SettingsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan informasi pengguna dan kartu status Google Drive', () => {
    render(
      <TestWrapper
        authValue={{
          user: {
            ...defaultMockUser,
            name: 'Budi Santoso',
            email: 'budi@kampus.ac.id',
            driveStatus: 'CONNECTED',
          },
        }}
      >
        <SettingsPage />
      </TestWrapper>,
    );

    expect(screen.getByText('Pengaturan Akun')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('budi@kampus.ac.id')).toBeInTheDocument();
    expect(screen.getByText('Terhubung')).toBeInTheDocument();
    expect(screen.getByText('Hapus Akun Permanen')).toBeInTheDocument();
  });

  it('membuka modal konfirmasi hapus akun dan memvalidasi pengetikan kata "HAPUS"', async () => {
    let deletedMe = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/users/me') && opts?.method === 'DELETE') {
        const body = JSON.parse(opts.body);
        if (body.confirm === 'HAPUS') {
          deletedMe = true;
          return { ok: true, status: 204 };
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>,
    );

    // Klik tombol buka dialog hapus akun
    const openModalBtn = screen.getByRole('button', { name: /Hapus Akun Saya/i });
    fireEvent.click(openModalBtn);

    // Dialog muncul
    expect(screen.getByText('Konfirmasi Hapus Akun')).toBeInTheDocument();
    const confirmInput = screen.getByPlaceholderText('HAPUS');
    const executeBtn = screen.getByRole('button', { name: 'Hapus Akun Permanen' });

    // Tombol masih disabled sebelum mengetik HAPUS
    expect(executeBtn).toBeDisabled();

    // Ketik kata yang salah
    fireEvent.change(confirmInput, { target: { value: 'hapus' } });
    expect(executeBtn).toBeDisabled();

    // Ketik HAPUS huruf kapital persis
    fireEvent.change(confirmInput, { target: { value: 'HAPUS' } });
    expect(executeBtn).not.toBeDisabled();

    // Klik tombol eksekusi hapus
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(deletedMe).toBe(true);
    });
  });
});
