import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, clearSession } from './client.js';

export interface DeleteUserBody {
  confirm: 'HAPUS';
}

/**
 * Hapus akun pengguna secara permanen: DELETE /users/me
 * Body wajib { confirm: "HAPUS" }
 */
export async function deleteCurrentUser(confirm: 'HAPUS'): Promise<void> {
  return apiFetch<void>('/users/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirm }),
  });
}

/**
 * Hook mutasi untuk menghapus akun pengguna saat ini.
 * Setelah sukses, sesi memori dibersihkan dan cache react-query di-reset.
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteCurrentUser('HAPUS'),
    onSuccess: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

