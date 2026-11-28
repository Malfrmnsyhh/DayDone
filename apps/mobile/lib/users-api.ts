import {
  type DeleteUserDto,
  deleteUserSchema,
  getErrorMessage,
} from '@daydone/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch, clearSession } from './api-client';
import { signOutGoogle } from './google-signin';

export type DeleteConfirmationValidationResult =
  | { valid: true; data: DeleteUserDto }
  | { valid: false; error: string };

/**
 * Memvalidasi teks konfirmasi penghapusan akun memakai `deleteUserSchema` dari @daydone/shared.
 * Wajib bernilai persis "HAPUS" (huruf kapital tanpa spasi tambahan).
 */
export function validateDeleteAccountConfirmation(
  confirmInput: string,
): DeleteConfirmationValidationResult {
  const parsed = deleteUserSchema.safeParse({ confirm: confirmInput });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      valid: false,
      error:
        firstIssue?.message ??
        'Konfirmasi penghapusan akun wajib bernilai "HAPUS"',
    };
  }

  return { valid: true, data: parsed.data };
}

/**
 * Mengembalikan true hanya bila input teks konfirmasi persis "HAPUS".
 */
export function isDeleteConfirmationValid(confirmInput: string): boolean {
  return deleteUserSchema.safeParse({ confirm: confirmInput }).success;
}

/**
 * Membentuk 1–2 huruf inisial untuk fallback avatar bila foto Google tidak tersedia/gagal dimuat.
 */
export function getUserInitials(
  name?: string | null,
  email?: string | null,
): string {
  const cleanName = name?.trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }

  const cleanEmail = email?.trim();
  if (cleanEmail) {
    return cleanEmail.slice(0, 2).toUpperCase();
  }

  return 'DD';
}

/**
 * Memetakan error penghapusan akun ke pesan Bahasa Indonesia yang jelas.
 */
export function getDeleteAccountErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code
      ? getErrorMessage(error.code, error.message)
      : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Gagal menghapus akun. Silakan coba lagi.';
}

/**
 * Hook mutasi DELETE /users/me dengan konfirmasi ketat { confirm: "HAPUS" }.
 * Setelah sukses, seluruh sesi lokal, cache Google SDK, dan cache TanStack Query dibersihkan.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (confirmInput) => {
      const validation = validateDeleteAccountConfirmation(confirmInput);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      await apiFetch<void>('/users/me', {
        method: 'DELETE',
        body: JSON.stringify(validation.data),
      });
    },
    onSuccess: async () => {
      await signOutGoogle();
      await clearSession();
      queryClient.clear();
    },
  });
}
