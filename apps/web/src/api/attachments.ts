import type { Attachment } from '@daydone/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error.js';
import { apiFetch, getAccessToken, getBaseUrl, refreshSession } from './client.js';

/**
 * Unggah satu file gambar dengan XMLHttpRequest untuk memantau progress akurat (0–100%).
 * Sesuai kontrak backend: POST /logs/:id/attachments (multipart/form-data, field `files`).
 */
export async function uploadAttachmentXHR(
  logId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<Attachment> {
  let token = getAccessToken();
  if (!token) {
    token = await refreshSession();
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getBaseUrl()}/logs/${logId}/attachments`;

    xhr.open('POST', url);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      try {
        const responseJson = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          // Backend mengembalikan { data: Attachment[] }
          const attachments: Attachment[] = responseJson.data;
          if (attachments && attachments.length > 0) {
            resolve(attachments[0]);
          } else {
            resolve(responseJson as Attachment);
          }
        } else {
          reject(
            new ApiError({
              ...responseJson,
              statusCode: xhr.status,
            }),
          );
        }
      } catch {
        reject(
          new ApiError({
            message: 'Respons server tidak dapat diproses',
            statusCode: xhr.status || 500,
          }),
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiError({
          message: 'Gagal terhubung ke server saat mengunggah foto',
          statusCode: 0,
        }),
      );
    };

    xhr.onabort = () => {
      reject(
        new ApiError({
          message: 'Pengunggahan dibatalkan',
          statusCode: 0,
        }),
      );
    };

    const formData = new FormData();
    formData.append('files', file);
    xhr.send(formData);
  });
}

/**
 * Hapus 1 lampiran berdasarkan ID: DELETE /attachments/:id -> 204 No Content
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  return apiFetch<void>(`/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

/**
 * Ambil signed URL segar untuk lampiran yang kedaluwarsa: GET /attachments/:id/url
 */
export async function getAttachmentFreshUrl(
  attachmentId: string,
): Promise<{ url: string; expiresAt: string }> {
  return apiFetch<{ url: string; expiresAt: string }>(`/attachments/${attachmentId}/url`);
}

/**
 * Hook untuk menghapus lampiran dengan mutasi TanStack Query.
 * Otomatis menginvalidasi query detail logbook dan list logbook.
 */
export function useDeleteAttachment(logId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', 'detail', logId] });
      queryClient.invalidateQueries({ queryKey: ['logs', 'list'] });
    },
  });
}
