import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { DomainException } from '../../common/errors/domain.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type {
  GoogleAuthResult,
  GoogleOAuthService,
} from './google-oauth.interface.js';

@Injectable()
export class RealGoogleOAuthService implements GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly webClientId: string;

  constructor(private readonly configService: ConfigService) {
    this.webClientId = this.configService.getOrThrow<string>(
      'GOOGLE_WEB_CLIENT_ID',
    );
    const clientSecret = this.configService.getOrThrow<string>(
      'GOOGLE_WEB_CLIENT_SECRET',
    );

    this.client = new OAuth2Client({
      clientId: this.webClientId,
      clientSecret,
    });
  }

  async exchangeCode(
    code: string,
    platform: 'WEB' | 'MOBILE',
    redirectUri?: string,
  ): Promise<GoogleAuthResult> {
    try {
      const resolvedRedirectUri =
        platform === 'WEB' ? (redirectUri ?? 'postmessage') : '';

      const { tokens } = await this.client.getToken({
        code,
        redirect_uri: resolvedRedirectUri,
      });

      if (!tokens.id_token) {
        throw new DomainException(
          HttpStatus.UNAUTHORIZED,
          'ID Token Google tidak ditemukan',
          ErrorCode.GOOGLE_AUTH_FAILED,
        );
      }

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.webClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new DomainException(
          HttpStatus.UNAUTHORIZED,
          'Payload Google ID Token tidak valid',
          ErrorCode.GOOGLE_AUTH_FAILED,
        );
      }

      if (payload.email_verified !== true) {
        throw new DomainException(
          HttpStatus.UNAUTHORIZED,
          'Email Google belum diverifikasi',
          ErrorCode.GOOGLE_AUTH_FAILED,
        );
      }

      const grantedScopes = tokens.scope ?? '';
      const driveGranted = grantedScopes.includes(
        'https://www.googleapis.com/auth/drive.file',
      );

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
        refreshToken: tokens.refresh_token ?? undefined,
        driveGranted,
      };
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'Autentikasi Google gagal',
        ErrorCode.GOOGLE_AUTH_FAILED,
        {
          originalMessage:
            error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
}
