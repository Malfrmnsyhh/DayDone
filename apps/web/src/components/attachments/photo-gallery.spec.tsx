import type { Attachment } from '@daydone/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestWrapper } from '../../test/test-utils.js';
import { PhotoGallery } from './photo-gallery.js';

describe('PhotoGallery Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const dummyAttachments: Attachment[] = [
    {
      id: 'att-1',
      fileName: '2026-11-06_foto1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
      position: 0,
      url: 'http://localhost:3000/api/v1/attachments/att-1/content?token=abc',
      urlExpiresAt: '2026-11-06T12:00:00.000Z',
    },
    {
      id: 'att-2',
      fileName: '2026-11-06_foto2.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      width: 1024,
      height: 768,
      position: 1,
      url: 'http://localhost:3000/api/v1/attachments/att-2/content?token=xyz',
      urlExpiresAt: '2026-11-06T12:00:00.000Z',
    },
  ];

  it('menampilkan thumbnail seluruh foto dengan benar', () => {
    render(
      <TestWrapper>
        <PhotoGallery attachments={dummyAttachments} logId="log-test-1" />
      </TestWrapper>,
    );

    expect(screen.getByText('Foto Dokumentasi (2/5)')).toBeInTheDocument();
    expect(screen.getByAltText('2026-11-06_foto1.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('2026-11-06_foto2.jpg')).toBeInTheDocument();
  });

  it('mengklik thumbnail membuka modal Lightbox fullscreen dan dapat ditutup dengan tombol atau tombol Escape', async () => {
    render(
      <TestWrapper>
        <PhotoGallery attachments={dummyAttachments} logId="log-test-1" />
      </TestWrapper>,
    );

    // Klik foto pertama untuk buka Lightbox
    const firstImgBtn = screen.getByLabelText(/Buka foto 1/i);
    fireEvent.click(firstImgBtn);

    // Lightbox modal tampil
    expect(screen.getByRole('dialog', { name: /Penampil foto layar penuh/i })).toBeInTheDocument();
    expect(screen.getByText('Foto 1 dari 2')).toBeInTheDocument();

    // Navigasi ke foto berikutnya
    const nextBtn = screen.getByLabelText('Foto berikutnya');
    fireEvent.click(nextBtn);
    expect(screen.getByText('Foto 2 dari 2')).toBeInTheDocument();

    // Tekan tombol Escape untuk menutup
    fireEvent.keyDown(window, { key: 'Escape' });
    const closeBtn = screen.getByLabelText('Tutup penampil foto');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('mengklik tombol hapus membuka ConfirmModal dan memanggil DELETE /attachments/:id', async () => {
    let deletedId = '';
    const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'DELETE') {
        deletedId = url.split('/').pop() || '';
        return { ok: true, status: 204 };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestWrapper>
        <PhotoGallery attachments={dummyAttachments} logId="log-test-1" />
      </TestWrapper>,
    );

    const deleteBtn = screen.getByLabelText('Hapus foto 2026-11-06_foto1.jpg');
    fireEvent.click(deleteBtn);

    // Modal konfirmasi terbuka
    expect(screen.getByText('Hapus Foto Dokumentasi?')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Hapus Foto' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deletedId).toBe('att-1');
    });
  });
});
