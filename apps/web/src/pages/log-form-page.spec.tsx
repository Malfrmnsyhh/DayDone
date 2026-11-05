import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogFormPage } from './log-form-page.js';
import { TestWrapper } from '../test/test-utils.js';

describe('LogFormPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mode buat: tanggal default hari ini, input tanggal aktif dan memiliki batas max', async () => {
    render(
      <TestWrapper initialEntries={['/logs/new']} routePath="/logs/new">
        <LogFormPage />
      </TestWrapper>,
    );

    expect(screen.getByText('Tulis Logbook Baru')).toBeInTheDocument();
    const dateInput = screen.getByLabelText(/Tanggal Logbook/i);
    expect(dateInput).not.toBeDisabled();
    expect(dateInput).toHaveAttribute('max');
  });

  it('mode ubah: data terisi dari detail, tanggal TIDAK di-disable', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/logs/log-123')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: 'log-123',
              date: '2026-11-04',
              description: 'Deskripsi yang akan diedit',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper
        initialEntries={['/logs/log-123/edit']}
        routePath="/logs/:id/edit"
      >
        <LogFormPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ubah Catatan Logbook')).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/Tanggal Logbook/i) as HTMLInputElement;
    expect(dateInput).not.toBeDisabled();
    expect(dateInput.value).toBe('2026-11-04');

    const descInput = screen.getByLabelText(/Deskripsi Kegiatan Magang/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe('Deskripsi yang akan diedit');
  });

  it('validasi form: deskripsi kosong ditolak dengan pesan validasi', async () => {
    render(
      <TestWrapper initialEntries={['/logs/new']} routePath="/logs/new">
        <LogFormPage />
      </TestWrapper>,
    );

    const submitBtn = screen.getByRole('button', { name: /Simpan Logbook/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Deskripsi wajib diisi/i)).toBeInTheDocument();
    });
  });

  it('penanganan 409 LOG_DATE_CONFLICT pada mode buat: tampilkan pesan dan link ke logbook terkait', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 409,
        json: async () => ({
          statusCode: 409,
          code: 'LOG_DATE_CONFLICT',
          message: 'Logbook untuk tanggal ini sudah pernah dibuat',
          existingLogId: 'existing-uuid-999',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper initialEntries={['/logs/new']} routePath="/logs/new">
        <LogFormPage />
      </TestWrapper>,
    );

    const descInput = screen.getByLabelText(/Deskripsi Kegiatan Magang/i);
    fireEvent.change(descInput, { target: { value: 'Aktivitas magang hari ini' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Logbook/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText(/Logbook untuk tanggal ini sudah pernah dibuat/i),
      ).toBeInTheDocument();
      const link = screen.getByRole('link', {
        name: /Buka logbook tanggal itu/i,
      });
      expect(link).toHaveAttribute('href', '/logs/existing-uuid-999');
    });
  });

  it('penanganan 409 LOG_DATE_CONFLICT pada mode ubah: tanggal bentrok dengan tanggal logbook lain', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            statusCode: 409,
            code: 'LOG_DATE_CONFLICT',
            message: 'Logbook untuk tanggal ini sudah pernah dibuat',
            existingLogId: 'conflict-target-id',
          }),
        };
      }

      // Initial GET log detail
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: 'log-current-id',
            date: '2026-11-03',
            description: 'Logbook yang sedang diubah',
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper
        initialEntries={['/logs/log-current-id/edit']}
        routePath="/logs/:id/edit"
      >
        <LogFormPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ubah Catatan Logbook')).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/Tanggal Logbook/i);
    // Ubah tanggal ke tanggal lain yang ternyata sudah ada
    fireEvent.change(dateInput, { target: { value: '2026-11-01' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      const link = screen.getByRole('link', {
        name: /Buka logbook tanggal itu/i,
      });
      expect(link).toHaveAttribute('href', '/logs/conflict-target-id');
    });
  });
});
