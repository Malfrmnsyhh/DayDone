import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  sessionId: string;
}

/**
 * Mengambil informasi pengguna dan sesi yang terautentikasi dari request (disimpan oleh JwtAuthGuard).
 * Mengembalikan objek { userId: string, sessionId: string }.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
