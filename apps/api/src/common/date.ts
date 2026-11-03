/**
 * Mengonversi string tanggal ISO (YYYY-MM-DD) ke objek Date tepat pada 00:00:00.000 UTC
 * untuk disimpan ke kolom @db.Date di PostgreSQL.
 */
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/**
 * Mengonversi objek Date dari kolom @db.Date Prisma (yang selalu dikembalikan pada 00:00 UTC)
 * ke format string YYYY-MM-DD untuk batas API.
 */
export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
