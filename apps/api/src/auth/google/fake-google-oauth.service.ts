import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type {
  GoogleAuthResult,
  GoogleOAuthService,
} from './google-oauth.interface.js';

@Injectable()
export class FakeGoogleOAuthService implements GoogleOAuthService {
  private readonly scenarios = new Map<string, GoogleAuthResult>();

  constructor() {
    this.resetDefaults();
  }

  resetDefaults() {
    this.scenarios.clear();

    // Default User A
    this.scenarios.set('code-dev-a', {
      googleId: 'google-dev-a',
      email: 'dev-a@daydone.local',
      name: 'Dev A',
      avatarUrl: 'https://example.com/dev-a.jpg',
      refreshToken: 'fake-refresh-token-a',
      driveGranted: true,
    });

    // Default User A tanpa refresh token (misal login ulang)
    this.scenarios.set('code-dev-a-no-refresh', {
      googleId: 'google-dev-a',
      email: 'dev-a@daydone.local',
      name: 'Dev A',
      avatarUrl: 'https://example.com/dev-a.jpg',
      refreshToken: undefined,
      driveGranted: true,
    });

    // Default User A scope Drive ditolak
    this.scenarios.set('code-dev-a-no-drive', {
      googleId: 'google-dev-a',
      email: 'dev-a@daydone.local',
      name: 'Dev A',
      avatarUrl: 'https://example.com/dev-a.jpg',
      refreshToken: 'fake-refresh-token-a',
      driveGranted: false,
    });

    // Default User B
    this.scenarios.set('code-dev-b', {
      googleId: 'google-dev-b',
      email: 'dev-b@daydone.local',
      name: 'Dev B',
      avatarUrl: null,
      refreshToken: 'fake-refresh-token-b',
      driveGranted: true,
    });
  }

  registerScenario(code: string, result: GoogleAuthResult) {
    this.scenarios.set(code, result);
  }

  async exchangeCode(code: string): Promise<GoogleAuthResult> {
    if (code === 'code-unverified-email') {
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'Email Google belum diverifikasi',
        ErrorCode.GOOGLE_AUTH_FAILED,
      );
    }

    const scenario = this.scenarios.get(code);
    if (!scenario) {
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'Autentikasi Google gagal: Kode otorisasi tidak valid',
        ErrorCode.GOOGLE_AUTH_FAILED,
      );
    }

    return scenario;
  }
}
