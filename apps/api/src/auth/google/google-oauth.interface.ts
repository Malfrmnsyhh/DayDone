export interface GoogleAuthResult {
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  refreshToken?: string;
  driveGranted: boolean;
}

export interface GoogleOAuthService {
  exchangeCode(
    code: string,
    platform: 'WEB' | 'MOBILE',
    redirectUri?: string,
  ): Promise<GoogleAuthResult>;
}

export const GOOGLE_OAUTH_SERVICE = Symbol('GOOGLE_OAUTH_SERVICE');

