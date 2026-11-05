export type DriveStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'NEEDS_RECONNECT';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  driveStatus: DriveStatus;
}

export type UserProfileResponse = User;
