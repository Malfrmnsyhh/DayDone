import type { AuthResponse, DriveStatus } from '@daydone/shared';

export type DriveStatusTone = 'connected' | 'warning' | 'neutral';

export interface DriveStatusInfo {
  title: string;
  badgeLabel: string;
  description: string;
  actionLabel: string;
  tone: DriveStatusTone;
}

/**
 * Mengembalikan true bila banner ajakan hubungkan/rekoneksi Google Drive perlu ditampilkan.
 */
export function shouldShowDriveBanner(status?: DriveStatus): boolean {
  return status === 'NOT_CONNECTED' || status === 'NEEDS_RECONNECT';
}

/**
 * Memetakan status koneksi Google Drive dari API menjadi informasi ringkas
 * dan nada tampilan (tone) untuk UI mobile.
 */
export function getDriveStatusInfo(status?: DriveStatus): DriveStatusInfo {
  switch (status) {
    case 'CONNECTED':
      return {
        title: 'Google Drive Terhubung',
        badgeLabel: 'Terhubung',
        description:
          'Foto dokumentasi akan otomatis tersimpan di folder DayDone Drive Anda.',
        actionLabel: 'Hubungkan Ulang Google Drive',
        tone: 'connected',
      };
    case 'NEEDS_RECONNECT':
      return {
        title: 'Perlu Hubungkan Ulang Drive',
        badgeLabel: 'Perlu Hubungkan Ulang',
        description:
          'Izin atau sesi Google Drive telah kedaluwarsa. Hubungkan ulang dan centang izin Drive agar foto lampiran dapat disimpan.',
        actionLabel: 'Hubungkan Ulang Google Drive',
        tone: 'warning',
      };
    case 'NOT_CONNECTED':
    default:
      return {
        title: 'Google Drive Belum Terhubung',
        badgeLabel: 'Belum Terhubung',
        description:
          'Foto dokumentasi logbook membutuhkan izin akses Google Drive pribadi Anda.',
        actionLabel: 'Hubungkan Google Drive',
        tone: 'neutral',
      };
  }
}

export type DriveReconnectOutcome = 'connected' | 'cancelled';

export interface DriveReconnectFlowDeps {
  requestAuthCode: () => Promise<string | null>;
  exchangeCode: (serverAuthCode: string) => Promise<AuthResponse>;
  onConnected: (response: AuthResponse) => Promise<void> | void;
}

/**
 * Orkestrasi alur rekoneksi Google Drive secara aman:
 * - Jika pengguna membatalkan dialog Google -> kembalikan 'cancelled' tanpa memutus sesi aktif.
 * - Jika jaringan/API gagal -> lempar error tanpa memutus sesi aktif.
 * - Jika sukses namun user tidak mencentang izin Drive -> perbarui sesi & lempar pesan yang jelas.
 */
export async function runDriveReconnectFlow({
  requestAuthCode,
  exchangeCode,
  onConnected,
}: DriveReconnectFlowDeps): Promise<DriveReconnectOutcome> {
  const serverAuthCode = await requestAuthCode();
  if (!serverAuthCode) {
    return 'cancelled';
  }

  const response = await exchangeCode(serverAuthCode);
  await onConnected(response);

  if (response.user?.driveStatus !== 'CONNECTED') {
    throw new Error(
      'Izin Google Drive belum dicentang. Silakan coba lagi dan pastikan kotak izin Google Drive dicentang.',
    );
  }

  return 'connected';
}
