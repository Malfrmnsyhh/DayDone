/**
 * Daftar kode error domain aplikasi DayDone sesuai docs/04-api-spec.md.
 */
export const ErrorCode = {
  LOG_DATE_CONFLICT: 'LOG_DATE_CONFLICT',
  ATTACHMENT_LIMIT_REACHED: 'ATTACHMENT_LIMIT_REACHED',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  DRIVE_NOT_CONNECTED: 'DRIVE_NOT_CONNECTED',
  DRIVE_RECONNECT_REQUIRED: 'DRIVE_RECONNECT_REQUIRED',
  DRIVE_STORAGE_FULL: 'DRIVE_STORAGE_FULL',
  DRIVE_UNAVAILABLE: 'DRIVE_UNAVAILABLE',
  GOOGLE_AUTH_FAILED: 'GOOGLE_AUTH_FAILED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Pemetaan pesan error ramah pengguna dalam bahasa Indonesia di satu tempat
 * berdasarkan kode error resmi pada docs/04-api-spec.md.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.LOG_DATE_CONFLICT]:
    'Logbook untuk tanggal ini sudah pernah dibuat. Anda dapat membuka atau mengedit logbook tersebut.',
  [ErrorCode.ATTACHMENT_LIMIT_REACHED]:
    'Batas maksimal 5 foto per logbook telah tercapai.',
  [ErrorCode.UNSUPPORTED_FILE_TYPE]:
    'Format file tidak didukung. Harap gunakan gambar berformat JPEG, PNG, atau WebP.',
  [ErrorCode.FILE_TOO_LARGE]:
    'Ukuran file melebihi batas maksimal 10 MB.',
  [ErrorCode.DRIVE_NOT_CONNECTED]:
    'Akun Google Drive belum terhubung. Silakan hubungkan akun Google Drive Anda.',
  [ErrorCode.DRIVE_RECONNECT_REQUIRED]:
    'Izin akses Google Drive telah kedaluwarsa atau dicabut. Silakan hubungkan ulang Google Drive.',
  [ErrorCode.DRIVE_STORAGE_FULL]:
    'Penyimpanan Google Drive Anda penuh. Kosongkan ruang penyimpanan dan coba lagi.',
  [ErrorCode.DRIVE_UNAVAILABLE]:
    'Layanan Google Drive sedang tidak dapat dijangkau. Silakan coba beberapa saat lagi.',
  [ErrorCode.GOOGLE_AUTH_FAILED]:
    'Autentikasi Google gagal atau kode otorisasi kedaluwarsa. Silakan ulangi login.',
  [ErrorCode.SESSION_EXPIRED]:
    'Sesi Anda telah berakhir. Silakan masuk kembali.',
};

/**
 * Mendapatkan pesan ramah pengguna dari ApiError atau kode error.
 */
export function getErrorMessage(code?: string, fallbackMessage?: string): string {
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code as ErrorCode];
  }
  return fallbackMessage || 'Terjadi kesalahan sistem. Silakan coba lagi.';
}

