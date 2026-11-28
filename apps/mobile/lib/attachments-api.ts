import type { AllowedImageMimeType, Attachment } from '@daydone/shared';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ErrorCode,
  getErrorMessage,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
} from '@daydone/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  apiFetch,
  getAccessToken,
  getBaseUrl,
  refreshSession,
} from './api-client';

export interface SelectedImageFile {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

export interface NormalizedUploadFile {
  uri: string;
  name: string;
  type: AllowedImageMimeType;
  sizeBytes?: number;
}

export type UploadQueueStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadQueueItem {
  id: string;
  fileName: string;
  file: NormalizedUploadFile;
  status: UploadQueueStatus;
  progress: number;
  errorMessage?: string;
}

export interface ValidateSelectedImagesResult {
  accepted: NormalizedUploadFile[];
  errors: string[];
  remainingQuota: number;
}

const EXTENSION_TO_MIME: Record<string, AllowedImageMimeType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MIME_TO_EXTENSION: Record<AllowedImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

/**
 * Menentukan MIME type gambar yang valid sesuai kontrak @daydone/shared.
 * Jika Android mengembalikan mimeType kosong, sistem jatuh kembali memeriksa ekstensi fileName atau URI.
 */
export function resolveImageMimeType(
  mimeType?: string | null,
  fileName?: string | null,
  uri?: string,
): AllowedImageMimeType | null {
  if (mimeType) {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized === 'image/jpg') {
      return 'image/jpeg';
    }
    if (ALLOWED_MIME_SET.has(normalized)) {
      return normalized as AllowedImageMimeType;
    }
    return null;
  }

  const source = fileName || uri || '';
  const cleanSource = source.split('?')[0].split('#')[0];
  const extMatch = /\.([a-z0-9]+)$/i.exec(cleanSource);
  if (!extMatch) {
    return null;
  }

  const ext = extMatch[1].toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? null;
}

/**
 * Membentuk nama file yang rapi untuk field multipart FormData.
 */
export function deriveUploadFileName(
  file: SelectedImageFile,
  mimeType: AllowedImageMimeType,
  index: number,
): string {
  const rawName = file.fileName?.trim();
  if (rawName) {
    return rawName;
  }

  const cleanUri = file.uri.split('?')[0].split('#')[0];
  const segments = cleanUri.split('/');
  const lastSegment = segments[segments.length - 1]?.trim();
  if (lastSegment && /\.[a-z0-9]+$/i.test(lastSegment)) {
    return lastSegment;
  }

  return `foto-${index + 1}.${MIME_TO_EXTENSION[mimeType]}`;
}

/**
 * Memvalidasi daftar foto terpilih sisi klien terhadap format MIME, ukuran maks 10 MB,
 * dan sisa kuota maksimal 5 foto per logbook.
 */
export function validateSelectedImages(
  files: readonly SelectedImageFile[],
  existingCount: number,
): ValidateSelectedImagesResult {
  const remainingQuota = Math.max(0, MAX_ATTACHMENTS - existingCount);
  const accepted: NormalizedUploadFile[] = [];
  const errors: string[] = [];

  if (remainingQuota === 0) {
    return {
      accepted,
      errors: [
        `Kuota maksimal ${MAX_ATTACHMENTS} foto per logbook sudah penuh.`,
      ],
      remainingQuota: 0,
    };
  }

  let quotaWarningAdded = false;

  files.forEach((file, index) => {
    const resolvedMime = resolveImageMimeType(
      file.mimeType,
      file.fileName,
      file.uri,
    );
    const displayName =
      file.fileName?.trim() || `Foto #${index + 1}`;

    if (!resolvedMime) {
      errors.push(
        `${displayName}: Format tidak didukung. Gunakan foto JPEG, PNG, atau WebP.`,
      );
      return;
    }

    if (
      typeof file.fileSize === 'number' &&
      file.fileSize > MAX_FILE_SIZE_BYTES
    ) {
      errors.push(
        `${displayName}: Ukuran file melebihi batas maksimal 10 MB.`,
      );
      return;
    }

    if (accepted.length >= remainingQuota) {
      if (!quotaWarningAdded) {
        errors.push(
          `Sisa kuota hanya ${remainingQuota} foto. Hanya ${remainingQuota} foto pertama yang diunggah.`,
        );
        quotaWarningAdded = true;
      }
      return;
    }

    accepted.push({
      uri: file.uri,
      name: deriveUploadFileName(file, resolvedMime, index),
      type: resolvedMime,
      sizeBytes: typeof file.fileSize === 'number' ? file.fileSize : undefined,
    });
  });

  return {
    accepted,
    errors,
    remainingQuota,
  };
}

/**
 * Memetakan error unggah lampiran ke pesan Bahasa Indonesia yang ramah pengguna.
 */
export function getAttachmentUploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code) {
      return getErrorMessage(error.code, error.message);
    }
    if (error.statusCode === 413) {
      return getErrorMessage(ErrorCode.FILE_TOO_LARGE);
    }
    if (error.statusCode === 415) {
      return getErrorMessage(ErrorCode.UNSUPPORTED_FILE_TYPE);
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Gagal mengunggah foto. Silakan coba lagi.';
}

function sendSingleUploadXHR(
  logId: string,
  file: NormalizedUploadFile,
  token: string | null,
  onProgress: (percent: number) => void,
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getBaseUrl()}/logs/${logId}/attachments`;

    xhr.open('POST', url);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(
          100,
          Math.round((event.loaded / event.total) * 100),
        );
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      try {
        const responseJson = xhr.responseText
          ? (JSON.parse(xhr.responseText) as Record<string, unknown>)
          : {};

        if (xhr.status >= 200 && xhr.status < 300) {
          const dataField = responseJson.data;
          if (Array.isArray(dataField) && dataField.length > 0) {
            resolve(dataField[0] as Attachment);
          } else {
            resolve(responseJson as unknown as Attachment);
          }
          return;
        }

        reject(
          new ApiError({
            statusCode: xhr.status,
            error:
              typeof responseJson.error === 'string'
                ? responseJson.error
                : undefined,
            message:
              typeof responseJson.message === 'string' ||
              Array.isArray(responseJson.message)
                ? (responseJson.message as string | string[])
                : undefined,
            code:
              typeof responseJson.code === 'string'
                ? responseJson.code
                : undefined,
          }),
        );
      } catch {
        reject(
          new ApiError({
            statusCode: xhr.status || 500,
            message: 'Respons server tidak dapat diproses.',
          }),
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiError({
          statusCode: 0,
          message: 'Gagal terhubung ke server saat mengunggah foto.',
        }),
      );
    };

    xhr.onabort = () => {
      reject(
        new ApiError({
          statusCode: 0,
          message: 'Pengunggahan foto dibatalkan.',
        }),
      );
    };

    // Format FormData file native React Native: { uri, name, type }
    const formData = new FormData();
    formData.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);

    xhr.send(formData);
  });
}

/**
 * Mengunggah satu foto ke POST /logs/:id/attachments memakai XMLHttpRequest
 * dengan pelacakan progress 0–100% dan auto-refresh token 1x bila menerima 401.
 */
export async function uploadAttachmentXHR(
  logId: string,
  file: NormalizedUploadFile,
  onProgress: (percent: number) => void,
): Promise<Attachment> {
  let token = getAccessToken();
  if (!token) {
    token = await refreshSession();
  }

  try {
    return await sendSingleUploadXHR(logId, file, token, onProgress);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.statusCode === 401) {
      const refreshedToken = await refreshSession();
      if (!refreshedToken) {
        throw new ApiError({
          statusCode: 401,
          error: 'Unauthorized',
          code: ErrorCode.SESSION_EXPIRED,
          message: getErrorMessage(ErrorCode.SESSION_EXPIRED),
        });
      }

      onProgress(0);
      return sendSingleUploadXHR(logId, file, refreshedToken, onProgress);
    }

    throw error;
  }
}

const FATAL_QUEUE_ERROR_CODES = new Set<string>([
  ErrorCode.SESSION_EXPIRED,
  ErrorCode.DRIVE_RECONNECT_REQUIRED,
  ErrorCode.DRIVE_NOT_CONNECTED,
  ErrorCode.ATTACHMENT_LIMIT_REACHED,
]);

export interface SequentialQueueOptions {
  items: readonly UploadQueueItem[];
  uploadFn: (
    file: NormalizedUploadFile,
    onProgress: (percent: number) => void,
  ) => Promise<Attachment>;
  onItemUpdate: (
    id: string,
    patch: Partial<Pick<UploadQueueItem, 'status' | 'progress' | 'errorMessage'>>,
  ) => void;
  onAnySuccess?: () => void;
}

/**
 * Menjalankan antrean unggah foto secara berurutan (1 file pada satu waktu)
 * agar koneksi mobile stabil dan progress tiap foto akurat.
 */
export async function runSequentialUploadQueue({
  items,
  uploadFn,
  onItemUpdate,
  onAnySuccess,
}: SequentialQueueOptions): Promise<{
  succeededCount: number;
  failedCount: number;
}> {
  let succeededCount = 0;
  let failedCount = 0;
  let fatalMessage: string | null = null;

  for (const item of items) {
    if (item.status !== 'pending') {
      continue;
    }

    if (fatalMessage) {
      failedCount += 1;
      onItemUpdate(item.id, {
        status: 'error',
        progress: 0,
        errorMessage: fatalMessage,
      });
      continue;
    }

    onItemUpdate(item.id, {
      status: 'uploading',
      progress: 0,
      errorMessage: undefined,
    });

    try {
      await uploadFn(item.file, (percent) => {
        onItemUpdate(item.id, { progress: percent });
      });

      succeededCount += 1;
      onItemUpdate(item.id, {
        status: 'done',
        progress: 100,
      });
    } catch (error: unknown) {
      failedCount += 1;
      const message = getAttachmentUploadErrorMessage(error);

      onItemUpdate(item.id, {
        status: 'error',
        errorMessage: message,
      });

      if (
        error instanceof ApiError &&
        error.code &&
        FATAL_QUEUE_ERROR_CODES.has(error.code)
      ) {
        fatalMessage = message;
      }
    }
  }

  if (succeededCount > 0 && onAnySuccess) {
    onAnySuccess();
  }

  return { succeededCount, failedCount };
}

/**
 * Menghapus 1 lampiran foto (DELETE /attachments/:id) dan menginvalidasi seluruh cache ['logs']
 * agar Detail, Daftar (attachmentCount), dan Beranda otomatis sinkron.
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (attachmentId) =>
      apiFetch<void>(`/attachments/${attachmentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}
