import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogDetailPage } from './log-detail-page.js';
import { TestWrapper } from '../test/test-utils.js';

describe('LogDetailPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan detail logbook dengan tanggal terformat dan teks deskripsi', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/logs/log-test-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'log-test-1',
            date: '2026-11-05',
            description: 'Deskripsi baris pertama\nDeskripsi baris kedua',
            attachmentCount: 0,
            attachments: [],
            createdAt: '2026-11-05T00:00:00.000Z',
            updatedAt: '2026-11-05T00:00:00.000Z',
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper initialEntries={['/logs/log-test-1']} routePath="/logs/:id">
        <LogDetailPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/November 2026/i)).toBeInTheDocument();
      expect(
        screen.getByText((content) =>
          content.includes('Deskripsi baris pertama') &&
          content.includes('Deskripsi baris kedua'),
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Ubah/i })).toHaveAttribute(
      'href',
      '/logs/log-test-1/edit',
    );
    expect(screen.getByRole('button', { name: /Hapus/i })).toBeInTheDocument();
  });

  it('menampilkan NotFoundState bila API membalas 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        statusCode: 404,
        error: 'Not Found',
        message: 'Logbook tidak ditemukan',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper initialEntries={['/logs/log-404']} routePath="/logs/:id">
        <LogDetailPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Logbook Tidak Ditemukan'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Kembali ke Dashboard/i }),
      ).toBeInTheDocument();
    });
  });

  it('membuka modal dialog saat tombol Hapus diklik dan memicu mutasi delete', async () => {
    let deleted = false;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts?: any) => {
      if (opts?.method === 'DELETE') {
        deleted = true;
        return { ok: true, status: 204 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'log-delete-target',
          date: '2026-11-05',
          description: 'Logbook yang akan dihapus',
          attachmentCount: 0,
          attachments: [],
          createdAt: '2026-11-05T00:00:00.000Z',
          updatedAt: '2026-11-05T00:00:00.000Z',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper
        initialEntries={['/logs/log-delete-target']}
        routePath="/logs/:id"
      >
        <LogDetailPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Logbook yang akan dihapus')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /Hapus/i });
    fireEvent.click(deleteBtn);

    // Modal dialog konfirmasi muncul
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /Hapus Logbook\?/i }),
      ).toBeInTheDocument();
    });

    // Klik tombol konfirmasi hapus di dalam dialog
    const confirmBtn = screen.getByRole('button', {
      name: /Ya, Hapus Logbook/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });
});
