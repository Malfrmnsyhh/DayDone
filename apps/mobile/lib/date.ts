/**
 * Mengembalikan string tanggal hari ini dalam format YYYY-MM-DD
 * berdasarkan zona waktu lokal perangkat pengguna (BUKAN UTC / toISOString).
 */
export function getTodayLocalDateString(now: Date = new Date()): string {
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
 * Contoh default: "Kamis, 26 November 2026"
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
 * Memformat string YYYY-MM-DD menjadi format tanggal ringkas bahasa Indonesia.
 * Contoh: "26 Nov 2026"
 */
export function formatShortDateIndonesian(dateStr: string): string {
  return formatDateIndonesian(dateStr, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Mengembalikan string bulan berjalan lokal dalam format YYYY-MM (misal "2026-11")
 * untuk parameter query GET /logs/stats?month=YYYY-MM.
 */
export function getCurrentLocalMonthString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Memformat string YYYY-MM menjadi nama bulan dan tahun bahasa Indonesia.
 * Contoh: "2026-11" -> "November 2026"
 */
export function formatMonthYearIndonesian(monthStr: string): string {
  const date = parseLocalDate(`${monthStr}-01`);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Memvalidasi apakah string adalah format YYYY-MM-DD dan merupakan tanggal kalender nyata
 * (menolak tanggal tidak valid seperti "2026-02-30" atau "2026-13-01").
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/**
 * Menggeser tanggal YYYY-MM-DD sebanyak `deltaDays` hari pada kalender lokal
 * tanpa risiko pergeseran zona waktu UTC.
 */
export function shiftLocalDateString(
  dateStr: string,
  deltaDays: number,
): string {
  const base = parseLocalDate(dateStr);
  const shifted = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + deltaDays,
  );
  return getTodayLocalDateString(shifted);
}

/**
 * Menghitung hari kerja (Senin–Jumat) dalam `month` (YYYY-MM) yang belum memiliki logbook
 * mulai tanggal 1 sampai `today` (inklusif) menurut kalender lokal.
 */
export function getMissingWeekdays(
  month: string,
  loggedDates: readonly string[],
  today: string = getTodayLocalDateString(),
): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const logged = new Set(loggedDates);
  const missing: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    if (dateStr > today) break;

    const weekday = parseLocalDate(dateStr).getDay(); // 0 = Minggu, 6 = Sabtu
    const isWeekday = weekday >= 1 && weekday <= 5;
    if (isWeekday && !logged.has(dateStr)) {
      missing.push(dateStr);
    }
  }

  return missing;
}
