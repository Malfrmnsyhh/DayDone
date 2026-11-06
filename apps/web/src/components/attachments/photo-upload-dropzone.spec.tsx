import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestWrapper } from '../../test/test-utils.js';
import { PhotoUploadDropzone } from './photo-upload-dropzone.js';

describe('PhotoUploadDropzone Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menolak file jika format MIME bukan JPG, PNG, atau WebP', async () => {
    render(
      <TestWrapper>
        <PhotoUploadDropzone
          logId="log-test-1"
          currentAttachmentCount={0}
          driveStatus="CONNECTED"
        />
      </TestWrapper>,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const pdfFile = new File(['dummy-content'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Format file "document.pdf" tidak didukung/i),
      ).toBeInTheDocument();
    });
  });

  it('menolak file jika ukuran melebihi batas 10 MB', async () => {
    render(
      <TestWrapper>
        <PhotoUploadDropzone
          logId="log-test-1"
          currentAttachmentCount={0}
          driveStatus="CONNECTED"
        />
      </TestWrapper>,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Buat file fiktif 11 MB
    const hugeFile = new File([''], 'huge-photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(hugeFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [hugeFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Ukuran file "huge-photo.jpg" melebihi batas 10 MB/i),
      ).toBeInTheDocument();
    });
  });

  it('menolak jika jumlah file melebihi sisa kuota (maksimal 5)', async () => {
    render(
      <TestWrapper>
        <PhotoUploadDropzone
          logId="log-test-1"
          currentAttachmentCount={4} // sisa kuota 1
          driveStatus="CONNECTED"
        />
      </TestWrapper>,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file1 = new File(['img1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Maksimal 5 foto per logbook.*hanya dapat menambahkan 1 foto lagi/i),
      ).toBeInTheDocument();
    });
  });

  it('menonaktifkan dropzone dan menampilkan pesan saat kuota 5 sudah tercapai', () => {
    render(
      <TestWrapper>
        <PhotoUploadDropzone
          logId="log-test-1"
          currentAttachmentCount={5}
          driveStatus="CONNECTED"
        />
      </TestWrapper>,
    );

    expect(screen.getByText('Batas Maksimal 5 Foto Tercapai')).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('menonaktifkan dropzone saat status Drive belum siap', () => {
    render(
      <TestWrapper>
        <PhotoUploadDropzone
          logId="log-test-1"
          currentAttachmentCount={0}
          driveStatus="NOT_CONNECTED"
        />
      </TestWrapper>,
    );

    expect(screen.getByText('Akses Google Drive Diperlukan')).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});
