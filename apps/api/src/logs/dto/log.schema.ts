import { z } from 'zod';

export const createLogSchema = z.object({
    date: z.iso.date(),
    description: z
        .string()
        .trim()
        .min(1, "Deskripsi wajib diisi")
        .max(10000, "Deskripsi maksimal 10000 karakter"),
});

export const updateLogSchema = createLogSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
        message: "Minimal satu field harus diisi",
});

export const listLogsQuerySchema = z.object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
});

export type CreateLogDto = z.infer<typeof createLogSchema>;
export type UpdateLogDto = z.infer<typeof updateLogSchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
