import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  CurrentUser,
  type CurrentUserData,
} from '../common/decorators/current-user.decorator.js';
import {
  deleteUserSchema,
  type DeleteUserDto,
} from './dto/delete-user.schema.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.cookieSecure = this.configService.get<boolean>('COOKIE_SECURE', true);
    this.cookieSameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAMESITE',
      'lax',
    );
  }

  /**
   * Menghapus akun pengguna saat ini secara permanen.
   * Membutuhkan konfirmasi eksplisit { confirm: "HAPUS" }.
   * Membersihkan cookie sesi web dan mengembalikan status 204 No Content.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(
    @CurrentUser() user: CurrentUserData,
    @Body({ schema: deleteUserSchema }) _dto: DeleteUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.usersService.deleteMe(user.userId);

    res.clearCookie('daydone_rt', {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/api/v1/auth',
    });
  }
}

