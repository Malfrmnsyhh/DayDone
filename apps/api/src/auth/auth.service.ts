import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EncryptionService } from '../common/crypto/encryption.service.js';
import {
  DriveStatus,
  type ClientPlatform,
  type User,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GoogleLoginDto } from './dto/auth.schema.js';
import type {
  AuthResponse,
  RefreshResponse,
  UserProfileResponse,
} from './dto/auth.types.js';
import {
  GOOGLE_OAUTH_SERVICE,
  type GoogleOAuthService,
} from './google/google-oauth.interface.js';
import { SessionsService } from './sessions/sessions.service.js';

@Injectable()
export class AuthService {
  private readonly jwtAccessTtl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
    private readonly sessionsService: SessionsService,
    @Inject(GOOGLE_OAUTH_SERVICE)
    private readonly googleOAuthService: GoogleOAuthService,
  ) {
    this.jwtAccessTtl = this.configService.get<string>(
      'JWT_ACCESS_TTL',
      '15m',
    );
  }

  /**
   * Menukarkan kode Google OAuth, upsert user, dan menerbitkan JWT access token serta sesi DayDone.
   */
  async googleLogin(
    dto: GoogleLoginDto,
    userAgent?: string,
  ): Promise<AuthResponse & { rawSessionRefreshToken: string }> {
    const googleProfile = await this.googleOAuthService.exchangeCode(
      dto.code,
      dto.platform,
      dto.redirectUri,
    );

    // Cari user yang sudah ada berdasarkan googleId
    const existingUser = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.googleId },
    });

    // Enkripsi refresh token Google jika ada; jika tidak, pertahankan yang lama
    let encryptedRefreshToken: string | null = null;
    if (googleProfile.refreshToken) {
      encryptedRefreshToken = this.encryptionService.encrypt(
        googleProfile.refreshToken,
      );
    } else if (existingUser?.googleRefreshToken) {
      encryptedRefreshToken = existingUser.googleRefreshToken;
    }

    // Tentukan driveStatus sesuai scope & keberadaan refresh token
    let driveStatus: DriveStatus = DriveStatus.NOT_CONNECTED;
    if (googleProfile.driveGranted) {
      if (encryptedRefreshToken) {
        driveStatus = DriveStatus.CONNECTED;
      } else {
        driveStatus = DriveStatus.NEEDS_RECONNECT;
      }
    }

    // Upsert user berdasarkan googleId
    const user = await this.prisma.user.upsert({
      where: { googleId: googleProfile.googleId },
      create: {
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name,
        avatarUrl: googleProfile.avatarUrl,
        googleRefreshToken: encryptedRefreshToken,
        driveStatus,
        driveFolderId: null,
      },
      update: {
        email: googleProfile.email,
        name: googleProfile.name ?? existingUser?.name,
        avatarUrl: googleProfile.avatarUrl ?? existingUser?.avatarUrl,
        googleRefreshToken: encryptedRefreshToken,
        driveStatus,
      },
    });

    // Buat sesi DayDone
    const { session, refreshToken: rawSessionRefreshToken } =
      await this.sessionsService.createSession(
        user.id,
        dto.platform as ClientPlatform,
        userAgent,
      );

    // Terbitkan JWT access token
    const { accessToken, accessTokenExpiresAt } = this.generateAccessToken(
      user.id,
      session.id,
    );

    return {
      accessToken,
      accessTokenExpiresAt,
      rawSessionRefreshToken,
      user: this.mapUserProfile(user),
    };
  }

  /**
   * Melakukan rotasi sesi refresh token dan menerbitkan access token baru.
   */
  async refresh(
    refreshToken: string,
    userAgent?: string,
  ): Promise<RefreshResponse & { rawSessionRefreshToken: string }> {
    const rotated = await this.sessionsService.rotateSession(
      refreshToken,
      userAgent,
    );

    const { accessToken, accessTokenExpiresAt } = this.generateAccessToken(
      rotated.user.id,
      rotated.session.id,
    );

    return {
      accessToken,
      accessTokenExpiresAt,
      rawSessionRefreshToken: rotated.refreshToken,
    };
  }

  /**
   * Mencabut sesi saat ini.
   */
  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.sessionsService.revokeSession(refreshToken);
    }
  }

  /**
   * Mengambil data profil user saat ini.
   */
  async getMe(userId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    return this.mapUserProfile(user);
  }

  private generateAccessToken(userId: string, sessionId: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, sid: sessionId },
      { expiresIn: this.jwtAccessTtl as any },
    );

    // Hitung tanggal kedaluwarsa access token (15 menit ke depan)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      accessToken,
      accessTokenExpiresAt: expiresAt,
    };
  }

  private mapUserProfile(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      driveStatus: user.driveStatus,
    };
  }
}

