import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  CurrentUser,
  type CurrentUserData,
} from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { AuthService } from './auth.service.js';
import {
  googleLoginSchema,
  logoutSchema,
  refreshTokenSchema,
  type GoogleLoginDto,
  type LogoutDto,
  type RefreshTokenDto,
} from './dto/auth.schema.js';
import type {
  AuthResponse,
  RefreshResponse,
  UserProfileResponse,
} from './dto/auth.types.js';

@ApiTags('Auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';
  private readonly cookieSecure: boolean;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.cookieSameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAMESITE',
      'lax',
    );
    this.cookieSecure = this.configService.get<boolean>('COOKIE_SECURE', true);
    this.refreshTtlDays = this.configService.get<number>(
      'REFRESH_TOKEN_TTL_DAYS',
      30,
    );
  }

  private getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/api/v1/auth',
      maxAge: this.refreshTtlDays * 24 * 60 * 60 * 1000,
    };
  }

  private getClearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/api/v1/auth',
    };
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Menukar authorization code Google dengan sesi DayDone' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'platform'],
      properties: {
        code: { type: 'string', description: 'Authorization code dari Google OAuth' },
        platform: { type: 'string', enum: ['WEB', 'MOBILE'] },
        redirectUri: { type: 'string', description: 'Redirect URI (opsional / postmessage)' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login berhasil, menghasilkan access token JWT dan sesi',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        accessTokenExpiresAt: { type: 'string', format: 'date-time' },
        refreshToken: { type: 'string', description: 'Hanya dikembalikan pada platform MOBILE' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            driveStatus: { type: 'string', enum: ['NOT_CONNECTED', 'CONNECTED', 'NEEDS_RECONNECT'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Body request tidak valid' })
  @ApiResponse({ status: 401, description: 'Kode otorisasi Google tidak valid atau kedaluwarsa (GOOGLE_AUTH_FAILED)' })
  async googleLogin(
    @Body({ schema: googleLoginSchema }) dto: GoogleLoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.googleLogin(dto, userAgent);

    if (dto.platform === 'WEB') {
      res.cookie('daydone_rt', result.rawSessionRefreshToken, this.getCookieOptions());

      return {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      };
    }

    return {
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.rawSessionRefreshToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Memperbarui access token sesi melalui rotasi refresh token' })
  @ApiHeader({
    name: 'X-Requested-With',
    required: false,
    description: 'Wajib bernilai daydone-web jika meminta refresh sesi berbasis cookie web',
  })
  @ApiCookieAuth('daydone_rt')
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', description: 'Refresh token (khusus platform MOBILE)' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token berhasil dirotasi',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        accessTokenExpiresAt: { type: 'string', format: 'date-time' },
        refreshToken: { type: 'string', description: 'Refresh token baru (khusus MOBILE)' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token tidak valid atau kedaluwarsa (SESSION_EXPIRED)' })
  @ApiResponse({ status: 403, description: 'Header X-Requested-With tidak valid untuk web' })
  async refresh(
    @Body({ schema: refreshTokenSchema }) dto: RefreshTokenDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-requested-with') xRequestedWith: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const cookieToken = req.cookies?.daydone_rt;

    // Bila refresh token ada di cookie atau request web
    if (cookieToken || (!dto.refreshToken && xRequestedWith)) {
      if (xRequestedWith !== 'daydone-web') {
        throw new ForbiddenException(
          'Header X-Requested-With: daydone-web wajib disertakan untuk request web',
        );
      }

      if (!cookieToken) {
        throw new DomainException(
          HttpStatus.UNAUTHORIZED,
          'Refresh token tidak ditemukan di cookie',
          ErrorCode.SESSION_EXPIRED,
        );
      }

      const result = await this.authService.refresh(cookieToken, userAgent);

      // Rotasi cookie refresh token dengan opsi yang persis sama
      res.cookie('daydone_rt', result.rawSessionRefreshToken, this.getCookieOptions());

      return {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
      };
    }

    // Alur Mobile (menggunakan refresh token dari body)
    if (!dto.refreshToken) {
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'Refresh token wajib disertakan',
        ErrorCode.SESSION_EXPIRED,
      );
    }

    const result = await this.authService.refresh(dto.refreshToken, userAgent);

    return {
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.rawSessionRefreshToken,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mencabut sesi pengguna saat ini' })
  @ApiHeader({
    name: 'X-Requested-With',
    required: false,
    description: 'Wajib bernilai daydone-web untuk permintaan platform web',
  })
  @ApiCookieAuth('daydone_rt')
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', description: 'Refresh token (khusus MOBILE)' },
      },
    },
  })
  @ApiResponse({ status: 204, description: 'Sesi berhasil dicabut' })
  @ApiResponse({ status: 403, description: 'Header X-Requested-With tidak valid untuk web' })
  async logout(
    @Body({ schema: logoutSchema }) dto: LogoutDto,
    @Headers('x-requested-with') xRequestedWith: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieToken = req.cookies?.daydone_rt;

    if (cookieToken || xRequestedWith) {
      if (xRequestedWith !== 'daydone-web') {
        throw new ForbiddenException(
          'Header X-Requested-With: daydone-web wajib disertakan untuk request web',
        );
      }

      res.clearCookie('daydone_rt', this.getClearCookieOptions());

      if (cookieToken) {
        await this.authService.logout(cookieToken);
      }
      return;
    }

    if (dto.refreshToken) {
      await this.authService.logout(dto.refreshToken);
    }
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Mengambil profil dan status Google Drive user saat ini' })
  @ApiResponse({
    status: 200,
    description: 'Profil pengguna',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        avatarUrl: { type: 'string', nullable: true },
        driveStatus: { type: 'string', enum: ['NOT_CONNECTED', 'CONNECTED', 'NEEDS_RECONNECT'] },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Access token tidak valid atau kedaluwarsa' })
  async getMe(
    @CurrentUser() user: CurrentUserData,
  ): Promise<UserProfileResponse> {
    return this.authService.getMe(user.userId);
  }
}
