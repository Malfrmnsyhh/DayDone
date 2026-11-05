/**
 * Mengembalikan string tanggal hari ini dalam format YYYY-MM-DD
 * berdasarkan zona waktu lokal perangkat pengguna (BUKAN UTC / toISOString).
 */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Melakukan parsing string YYYY-MM-DD menjadi objek Date pada zona waktu lokal
 * (jam 00:00:00 lokal), menghindari bug new Date("YYYY-MM-DD") yang dianggap UTC.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Memformat string YYYY-MM-DD menjadi format tanggal bahasa Indonesia yang ramah pembaca.
 * Contoh default: "Kamis, 5 November 2026"
 */
export function formatDateIndonesian(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

/**
 * Memformat string YYYY-MM-DD menjadi format tanggal ringkas.
 * Contoh: "5 Nov 2026"
 */
export function formatShortDateIndonesian(dateStr: string): string {
  return formatDateIndonesian(dateStr, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

