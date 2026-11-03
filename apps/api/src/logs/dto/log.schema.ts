import { z } from 'zod';

/**
 * Menghitung tanggal batas maksimal yang diizinkan (tanggal UTC server + 1 hari).
 * Dihitung dinamis setiap kali validasi berjalan untuk toleransi perbedaan zona waktu.
 */
export function getMaxAllowedDate(): string {
  const now = new Date();
  const maxDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return maxDate.toISOString().slice(0, 10);
}

export const createLogSchema = z
  .object({
    date: z.iso.date(),
    description: z
      .string()
      .trim()
      .min(1, 'Deskripsi wajib diisi')
      .max(5000, 'Deskripsi maksimal 5000 karakter'),
  })
  .refine((data) => data.date <= getMaxAllowedDate(), {
    message: 'Tanggal tidak boleh lebih dari 1 hari setelah tanggal server',
    path: ['date'],
  });

export const updateLogSchema = z
  .object({
    date: z.iso.date().optional(),
    description: z
      .string()
      .trim()
      .min(1, 'Deskripsi wajib diisi')
      .max(5000, 'Deskripsi maksimal 5000 karakter')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu field harus diisi',
  })
  .refine((data) => !data.date || data.date <= getMaxAllowedDate(), {
    message: 'Tanggal tidak boleh lebih dari 1 hari setelah tanggal server',
    path: ['date'],
    });

export const listLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Halaman minimal 1').default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, 'Limit minimal 1')
      .max(100, 'Limit maksimal 100')
      .default(20),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    search: z
      .string()
      .trim()
      .min(1, 'Pencarian minimal 1 karakter')
      .max(100, 'Pencarian maksimal 100 karakter')
      .optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Tanggal from harus lebih kecil atau sama dengan to',
    path: ['from'],
  });

export const dateParamSchema = z.object({
  date: z.iso.date(),
});

export type CreateLogDto = z.infer<typeof createLogSchema>;
export type UpdateLogDto = z.infer<typeof updateLogSchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
export type DateParam = z.infer<typeof dateParamSchema>;
