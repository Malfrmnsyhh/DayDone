import { z } from 'zod';

export const deleteUserSchema = z.object({
  confirm: z.literal('HAPUS', {
    message: 'Konfirmasi penghapusan akun wajib bernilai "HAPUS"',
  }),
});

export type DeleteUserDto = z.infer<typeof deleteUserSchema>;

