import type { DriveStatus } from '../../generated/prisma/client.js';

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  driveStatus: DriveStatus;
}

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

