import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestWrapper } from '../../test/test-utils.js';
import { MonthStatsCard } from './month-stats-card.js';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

describe('MonthStatsCard (FR-13)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Senin, 9 November 2026 (waktu lokal)
    vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('meminta stats untuk bulan lokal berjalan dan menampilkan angka', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        month: '2026-11',
        totalThisMonth: 2,
        totalAllTime: 30,
        loggedDates: ['2026-11-02', '2026-11-04'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <MonthStatsCard />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Logbook bulan ini')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/logs/stats?month=2026-11');
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    // 3, 5, 6, dan 9 November belum diisi
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(
      screen.getByText('Hari kerja (Sen–Jum) tanpa logbook'),
    ).toBeInTheDocument();
  });

  it('hari kosong berupa tautan ke form buat logbook dengan tanggal terisi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          month: '2026-11',
          totalThisMonth: 0,
          totalAllTime: 0,
          loggedDates: [],
        }),
      ),
    );

    render(
      <TestWrapper>
        <MonthStatsCard />
      </TestWrapper>,
    );

    const link = await screen.findByRole('link', {
      name: /Tulis logbook untuk Selasa, 3 November 2026/i,
    });
    expect(link).toHaveAttribute('href', '/logs/new?date=2026-11-03');
  });

  it('menampilkan pesan bila semua hari kerja sudah tercatat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          month: '2026-11',
          totalThisMonth: 6,
          totalAllTime: 6,
          loggedDates: [
            '2026-11-02',
            '2026-11-03',
            '2026-11-04',
            '2026-11-05',
            '2026-11-06',
            '2026-11-09',
          ],
        }),
      ),
    );

    render(
      <TestWrapper>
        <MonthStatsCard />
      </TestWrapper>,
    );

    expect(
      await screen.findByText(/Semua hari kerja bulan ini sudah tercatat/i),
    ).toBeInTheDocument();
  });

  it('menampilkan skeleton saat memuat dan pesan error berbahasa Indonesia saat gagal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'Server Error' }, 500)),
    );

    render(
      <TestWrapper>
        <MonthStatsCard />
      </TestWrapper>,
    );

    expect(screen.getByTestId('month-stats-skeleton')).toBeInTheDocument();
    expect(
      await screen.findByText(/Gagal memuat ringkasan statistik logbook/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Muat Ulang Ringkasan/i }),
    ).toBeInTheDocument();
  });
});
