import type { DriveStatus } from '@daydone/shared';

export type DriveStatusTone = 'connected' | 'warning' | 'neutral';

export interface DriveStatusInfo {
  title: string;
  description: string;
  tone: DriveStatusTone;
}

/**
 * Memetakan status koneksi Google Drive dari API menjadi informasi ringkas
 * dan nada tampilan (tone) untuk UI mobile.
 */
export function getDriveStatusInfo(
  status?: DriveStatus,
): DriveStatusInfo {
  switch (status) {
    case 'CONNECTED':
      return {
        title: 'Google Drive Terhubung',
        description:
          'Foto dokumentasi akan otomatis tersimpan di folder DayDone Drive Anda.',
        tone: 'connected',
      };
    case 'NEEDS_RECONNECT':
      return {
        title: 'Perlu Hubungkan Ulang Drive',
        description:
          'Izin atau sesi Google Drive telah kedaluwarsa. Hubungkan ulang agar foto lampiran dapat disimpan.',
        tone: 'warning',
      };
    case 'NOT_CONNECTED':
    default:
      return {
        title: 'Google Drive Belum Terhubung',
        description:
          'Foto dokumentasi logbook membutuhkan izin akses Google Drive pribadi Anda.',
        tone: 'neutral',
      };
  }
}
