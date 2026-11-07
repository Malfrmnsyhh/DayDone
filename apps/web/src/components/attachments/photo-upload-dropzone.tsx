import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
} from '@daydone/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { uploadAttachmentXHR } from '../../api/attachments.js';

export interface PhotoUploadDropzoneProps {
  logId: string;
  currentAttachmentCount: number;
  driveStatus?: string;
  onUploadSuccess?: () => void;
  className?: string;
}

interface FileQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export function PhotoUploadDropzone({
  logId,
  currentAttachmentCount,
  driveStatus = 'CONNECTED',
  onUploadSuccess,
  className = '',
}: PhotoUploadDropzoneProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Bersihkan Object URL preview saat komponen di-unmount untuk mencegah memory leak
  useEffect(() => {
    return () => {
      queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [queue]);

  const remainingSlots = Math.max(0, MAX_ATTACHMENTS - currentAttachmentCount);
  const isDriveReady = driveStatus === 'CONNECTED';
  const isLimitReached = remainingSlots <= 0;
  const isDisabled = isLimitReached || !isDriveReady || isUploading;

  const validateAndQueueFiles = (files: FileList | File[]) => {
    setGeneralError(null);
    const fileList = Array.from(files);

    if (fileList.length === 0) return;

    if (fileList.length > remainingSlots) {
      setGeneralError(
        `Maksimal 5 foto per logbook. Saat ini Anda hanya dapat menambahkan ${remainingSlots} foto lagi.`,
      );
      return;
    }

    const newQueueItems: FileQueueItem[] = [];

    for (const file of fileList) {
      // Validasi MIME
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as any)) {
        setGeneralError(
          `Format file "${file.name}" tidak didukung. Hanya file JPG, PNG, dan WebP yang diperbolehkan.`,
        );
        return;
      }

      // Validasi Ukuran (10 MB)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setGeneralError(
          `Ukuran file "${file.name}" melebihi batas 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        );
        return;
      }

      newQueueItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
      });
    }

    setQueue(newQueueItems);
    startSequentialUpload(newQueueItems);
  };

  const startSequentialUpload = async (items: FileQueueItem[]) => {
    setIsUploading(true);
    let anySuccess = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Perbarui status menjadi uploading
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading' } : q)),
      );

      try {
        await uploadAttachmentXHR(logId, item.file, (percent) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: percent } : q)),
          );
        });

        // Sukses
        anySuccess = true;
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, progress: 100, status: 'completed' } : q,
          ),
        );
      } catch (err: any) {
        const msg = err?.message || 'Gagal mengunggah foto.';
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'error', errorMessage: msg } : q,
          ),
        );
      }
    }

    setIsUploading(false);

    if (anySuccess) {
      // Invalidate query detail & list logbook
      queryClient.invalidateQueries({ queryKey: ['logs', 'detail', logId] });
      queryClient.invalidateQueries({ queryKey: ['logs', 'list'] });
      onUploadSuccess?.();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isDisabled) return;
    if (e.dataTransfer.files) {
      validateAndQueueFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndQueueFiles(e.target.files);
    }
    // Reset file input agar file yang sama bisa dipilih ulang bila gagal
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearQueue = () => {
    // Hapus Object URLs untuk cegah memory leak
    queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setQueue([]);
    setGeneralError(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Dropzone Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isDisabled) {
            fileInputRef.current?.click();
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        tabIndex={isDisabled ? -1 : 0}
        role="button"
        aria-label="Area unggah foto dokumentasi"
        className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all focus:outline-hidden ${
          isDisabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-50/70 text-slate-400'
            : isDragOver
              ? 'cursor-copy border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-100'
              : 'cursor-pointer border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isDisabled}
          onChange={handleFileChange}
        />

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
            isDisabled
              ? 'bg-slate-200/80 text-slate-400'
              : isDragOver
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-100'
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>

        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-800">
            {isLimitReached
              ? 'Batas Maksimal 5 Foto Tercapai'
              : !isDriveReady
                ? 'Akses Google Drive Diperlukan'
                : isDragOver
                  ? 'Lepaskan foto di sini...'
                  : 'Tarik & lepas foto ke sini, atau klik untuk memilih'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isLimitReached
              ? 'Hapus foto yang ada terlebih dahulu jika ingin menambahkan foto baru.'
              : !isDriveReady
                ? 'Hubungkan Google Drive pada banner di atas untuk mengaktifkan unggah foto.'
                : `Format JPG, PNG, atau WebP hingga 10 MB per foto (sisa kuota: ${remainingSlots} foto)`}
          </p>
        </div>
      </div>

      {/* Pesan Kesalahan Validasi Umum */}
      {generalError && (
        <div
          role="alert"
          className="flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Antrean & Progress Unggahan */}
      {queue.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h5 className="text-xs font-semibold text-slate-700">
              Proses Unggahan ({queue.filter((q) => q.status === 'completed').length}/
              {queue.length} Selesai)
            </h5>
            {!isUploading && (
              <button
                type="button"
                onClick={clearQueue}
                className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
                <span>Tutup</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-xs"
              >
                {/* Thumbnail Preview */}
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200"
                />

                {/* File info & Progress */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-medium text-slate-800" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <span className="shrink-0 text-slate-400 ml-2">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-1.5 flex items-center space-x-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.status === 'completed'
                            ? 'bg-emerald-500'
                            : item.status === 'error'
                              ? 'bg-rose-500'
                              : 'bg-indigo-600'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500">
                      {item.progress}%
                    </span>
                  </div>

                  {/* Error detail */}
                  {item.status === 'error' && item.errorMessage && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">
                      {item.errorMessage}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="shrink-0">
                  {item.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  )}
                  {item.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                  )}
                  {item.status === 'pending' && (
                    <FileImage className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

