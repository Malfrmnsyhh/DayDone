import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { EncryptionService } from '../common/crypto/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Menghapus akun pengguna beserta seluruh datanya di database:
   * 1. Mencabut refresh token Google (OAuth2Client.revokeToken) secara best-effort.
   * 2. Menghapus user di database (cascade otomatis menghapus sesi, logbook, lampiran).
   * File di Google Drive sengaja tidak dihapus sesuai kebijakan privasi dan dokumen desain.
   */
  async deleteMe(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleRefreshToken: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    // 1. Cabut token Google secara best-effort bila tersimpan
    if (user.googleRefreshToken) {
      try {
        const decryptedToken = this.encryptionService.decrypt(
          user.googleRefreshToken,
        );
        const auth = new OAuth2Client({
          clientId: this.configService.getOrThrow<string>(
            'GOOGLE_WEB_CLIENT_ID',
          ),
          clientSecret: this.configService.getOrThrow<string>(
            'GOOGLE_WEB_CLIENT_SECRET',
          ),
        });
        await auth.revokeToken(decryptedToken);
      } catch (err: unknown) {
        this.logger.warn(
          `Gagal mencabut token Google saat hapus akun user ${userId}: ${String((err as Error)?.message)}`,
        );
        // Abaikan kegagalan revoke token Google
      }
    }

    // 2. Hapus user di database (cascade otomatis menghapus baris di sessions, log_entries, attachments)
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }
}

