import { CalendarX2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLogStats } from '../../api/logs.js';
import {
  formatDateIndonesian,
  getCurrentLocalMonthString,
  getMissingWeekdays,
  getTodayLocalDateString,
} from '../../lib/date.js';

function formatMonthIndonesian(month: string): string {
  return formatDateIndonesian(`${month}-01`, { month: 'long', year: 'numeric' });
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <dd className="text-2xl font-bold text-slate-900 tabular-nums">{value}</dd>
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div
      className="animate-pulse grid grid-cols-1 sm:grid-cols-3 gap-3"
      aria-hidden="true"
      data-testid="month-stats-skeleton"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-[68px] rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

/**
 * Ringkasan bulan berjalan (FR-13): jumlah logbook bulan ini, total seluruh waktu,
 * dan hari kerja (Sen–Jum) yang belum diisi sampai hari ini.
 * Hari kosong dihitung di client dari `loggedDates` memakai tanggal lokal perangkat.
 */
export function MonthStatsCard() {
  const today = getTodayLocalDateString();
  const month = getCurrentLocalMonthString(today);
  const { data, isLoading, isError, refetch } = useLogStats(month);

  const missingDays = data
    ? getMissingWeekdays(month, data.loggedDates ?? [], today)
    : [];

  return (
    <section
      aria-labelledby="month-stats-heading"
      aria-busy={isLoading}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      <h2 id="month-stats-heading" className="text-sm font-bold text-slate-900">
        Ringkasan {formatMonthIndonesian(month)}
      </h2>

      {isLoading && <StatsSkeleton />}

      {isError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800">
          <span>Gagal memuat ringkasan statistik logbook.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Muat Ulang Ringkasan</span>
          </button>
        </div>
      )}

      {data && (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile value={data.totalThisMonth} label="Logbook bulan ini" />
            <StatTile value={data.totalAllTime} label="Total logbook" />
            <StatTile
              value={missingDays.length}
              label="Hari kerja (Sen–Jum) tanpa logbook"
            />
          </dl>

          {missingDays.length > 0 ? (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <CalendarX2 className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <span>Belum diisi — pilih tanggal untuk menulis logbook:</span>
              </p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Hari kerja tanpa logbook">
                {missingDays.map((date) => (
                  <li key={date}>
                    <Link
                      to={`/logs/new?date=${date}`}
                      aria-label={`Tulis logbook untuk ${formatDateIndonesian(date)}`}
                      className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                    >
                      {formatDateIndonesian(date, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs font-medium text-emerald-800">
              Semua hari kerja bulan ini sudah tercatat sampai hari ini.
            </p>
          )}
        </>
      )}
    </section>
  );
}
