import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './dashboard-page.js';
import { TestWrapper } from '../test/test-utils.js';

describe('DashboardPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan daftar logbook dan kartu hari ini saat data tersedia', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/logs/by-date/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'log-today',
            date: '2026-11-05',
            description: 'Mengerjakan fitur auth web',
            attachmentCount: 0,
            attachments: [],
            createdAt: '2026-11-05T00:00:00.000Z',
            updatedAt: '2026-11-05T00:00:00.000Z',
          }),
        };
      }

      if (url.includes('/logs')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'log-1',
                date: '2026-11-05',
                descriptionSnippet: 'Catatan logbook pertama',
                attachmentCount: 1,
                firstAttachmentThumbnailUrl: 'https://cdn.example.com/foto.jpg',
                createdAt: '2026-11-05T00:00:00.000Z',
                updatedAt: '2026-11-05T00:00:00.000Z',
              },
            ],
            meta: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );

    // Memverifikasi kartu hari ini
    await waitFor(() => {
      expect(
        screen.getByText(/Logbook Hari Ini Sudah Ditulis/i),
      ).toBeInTheDocument();
    });

    // Memverifikasi logbook di daftar
    expect(
      screen.getByText('Catatan logbook pertama'),
    ).toBeInTheDocument();
  });

  it('pencarian dan filter tanggal mereset page ke 1 di URL search params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [],
        meta: { page: 3, limit: 10, totalItems: 30, totalPages: 3 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper initialEntries={['/?page=3']}>
        <DashboardPage />
      </TestWrapper>,
    );

    const searchInput = screen.getByPlaceholderText(/Cari deskripsi logbook/i);
    fireEvent.change(searchInput, { target: { value: 'nest' } });

    // Tunggu debounce 300ms
    await waitFor(
      () => {
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
        const requestedUrl = String(lastCall[0]);
        expect(requestedUrl).toContain('search=nest');
        expect(requestedUrl).toContain('page=1');
      },
      { timeout: 1000 },
    );
  });

  it('menampilkan EmptyState saat daftar logbook kosong', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/logs/by-date/')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not Found' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Belum Ada Logbook/i)).toBeInTheDocument();
    });
  });

  it('menampilkan ErrorState dengan tombol coba lagi bila API error', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/logs/by-date/')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not Found' }),
        };
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Gagal Memuat Logbook/i)).toBeInTheDocument();
      expect(screen.getByText(/Coba Lagi/i)).toBeInTheDocument();
    });
  });

  it('thumbnail lampiran fallback ke placeholder bila gambar gagal dimuat (onError)', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/logs/by-date/')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'log-thumb',
              date: '2026-11-05',
              descriptionSnippet: 'Log dengan foto thumbnail',
              attachmentCount: 1,
              firstAttachmentThumbnailUrl: 'https://broken-url.com/img.jpg',
              createdAt: '2026-11-05T00:00:00.000Z',
              updatedAt: '2026-11-05T00:00:00.000Z',
            },
          ],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: /Thumbnail lampiran/i }),
      ).toBeInTheDocument();
    });

    const img = screen.getByRole('img', { name: /Thumbnail lampiran/i });
    fireEvent.error(img);

    // Gambar hilang dan digantikan oleh icon placeholder
    expect(
      screen.queryByRole('img', { name: /Thumbnail lampiran/i }),
    ).not.toBeInTheDocument();
  });
});
