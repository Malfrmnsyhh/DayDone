import type { UserProfileResponse } from './user.types.js';

export type AuthPlatform = 'WEB' | 'MOBILE';

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string;
  user?: UserProfileResponse;
}

export interface RefreshResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string;
}
