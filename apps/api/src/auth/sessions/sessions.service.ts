import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { DomainException } from '../../common/errors/domain.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type {
  ClientPlatform,
  Session,
  User,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreatedSessionResult {
  session: Session;
  refreshToken: string;
}

export interface RotatedSessionResult {
  session: Session;
  refreshToken: string;
  user: User;
}

class TokenReuseError extends Error {
  constructor(public readonly userId: string) {
    super('Token reuse detected');
  }
}

@Injectable()
export class SessionsService {
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.refreshTokenTtlDays = this.configService.get<number>(
      'REFRESH_TOKEN_TTL_DAYS',
      30,
    );
  }

  /**
   * Menghitung SHA-256 hex digest dari token string mentah.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Membuat sesi baru dengan refresh token 32-byte acak base64url.
   */
  async createSession(
    userId: string,
    platform: ClientPlatform,
    userAgent?: string,
  ): Promise<CreatedSessionResult> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

    const session = await this.prisma.session.create({
      data: {
        userId,
        platform,
        userAgent,
        refreshTokenHash,
        expiresAt,
      },
    });

    return { session, refreshToken };
  }

  /**
   * Melakukan rotasi refresh token secara atomik:
   * 1. Mencari sesi berdasarkan hash(refreshToken).
   * 2. Memeriksa masa kedaluwarsa.
   * 3. Mencabut sesi lama secara kondisional (where: { id, revokedAt: null }).
   *    Bila count === 0, artinya token sudah pernah dicabut/digunakan:
   *    -> Deteksi token reuse: cabut SELURUH sesi aktif user secara permanen dan tolak 401.
   * 4. Membuat sesi baru, memperbarui replacedById pada sesi lama.
   */
  async rotateSession(
    currentRefreshToken: string,
    userAgent?: string,
  ): Promise<RotatedSessionResult> {
    const tokenHash = this.hashToken(currentRefreshToken);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.session.findUnique({
          where: { refreshTokenHash: tokenHash },
          include: { user: true },
        });

        if (!session) {
          throw new DomainException(
            HttpStatus.UNAUTHORIZED,
            'Sesi tidak ditemukan atau tidak valid',
            ErrorCode.SESSION_EXPIRED,
          );
        }

        const now = new Date();

        if (session.expiresAt <= now) {
          throw new DomainException(
            HttpStatus.UNAUTHORIZED,
            'Sesi telah kedaluwarsa',
            ErrorCode.SESSION_EXPIRED,
          );
        }

        // Update kondisional: hanya jika belum dicabut
        const updateResult = await tx.session.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        // Bila count === 0, sesi ini sudah pernah dicabut atau dipakai sebelumnya
        if (updateResult.count === 0) {
          throw new TokenReuseError(session.userId);
        }

        // Buat token baru & sesi baru
        const newRefreshToken = randomBytes(32).toString('base64url');
        const newRefreshTokenHash = this.hashToken(newRefreshToken);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

        const newSession = await tx.session.create({
          data: {
            userId: session.userId,
            platform: session.platform,
            userAgent: userAgent ?? session.userAgent,
            refreshTokenHash: newRefreshTokenHash,
            expiresAt,
          },
        });

        // Tautkan sesi lama ke sesi pengganti
        await tx.session.update({
          where: { id: session.id },
          data: { replacedById: newSession.id },
        });

        return {
          session: newSession,
          refreshToken: newRefreshToken,
          user: session.user,
        };
      });
    } catch (error) {
      if (error instanceof TokenReuseError) {
        // Cabut SEMUA sesi aktif user secara persisten di database
        await this.prisma.session.updateMany({
          where: {
            userId: error.userId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        throw new DomainException(
          HttpStatus.UNAUTHORIZED,
          'Deteksi pemakaian ulang token: seluruh sesi telah dicabut',
          ErrorCode.SESSION_EXPIRED,
        );
      }

      throw error;
    }
  }

  /**
   * Mencabut sesi saat ini berdasarkan refresh token.
   */
  async revokeSession(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Memvalidasi apakah sesi aktif dan belum dicabut untuk JwtAuthGuard.
   * Juga memastikan relasi user pemilik akun masih ada di database.
   */
  async validateSession(
    sessionId: string,
  ): Promise<(Session & { user: User }) | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      !session.user
    ) {
      return null;
    }

    return session;
  }
}
