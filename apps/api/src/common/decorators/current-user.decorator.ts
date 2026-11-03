import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  email?: string;
}

/**
 * Mengambil informasi pengguna yang terautentikasi dari request (disimpan oleh Guard).
 * Mengembalikan objek { userId: string, email?: string }.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

