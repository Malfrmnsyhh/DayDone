import { z } from 'zod';

export const googleLoginSchema = z.object({
  code: z.string().min(1, 'Authorization code wajib diisi'),
  platform: z.enum(['WEB', 'MOBILE']),
  redirectUri: z.string().optional(),
});

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .default({});

export const logoutSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .default({});

export type GoogleLoginDto = z.infer<typeof googleLoginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;

