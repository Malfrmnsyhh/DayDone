import { ArrowRight, CheckCircle2, PenLine, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLogByDate } from '../../api/logs.js';
import {
  formatDateIndonesian,
  getTodayLocalDateString,
} from '../../lib/date.js';
import { CardSkeleton } from '../common/loading-skeleton.js';

export function TodayCard() {
  const today = getTodayLocalDateString();
  const { data, isLoading } = useLogByDate(today);

  if (isLoading) {
    return <CardSkeleton />;
  }

  const todayLog = data?.data;

  // Bila logbook hari ini sudah dibuat
  if (todayLog) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Hari Ini
                </span>
                <span className="text-xs text-emerald-600">•</span>
                <span className="text-xs text-emerald-700 font-medium">
                  {formatDateIndonesian(today)}
                </span>
              </div>
              <h2 className="text-base font-bold text-emerald-950 mt-0.5">
                Logbook Hari Ini Sudah Ditulis
              </h2>
              <p className="mt-1 text-xs text-emerald-800 line-clamp-2 max-w-xl">
                {todayLog.description}
              </p>
            </div>
          </div>

          <Link
            to={`/logs/${todayLog.id}`}
            className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition shrink-0"
          >
            <span>Buka Logbook</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Bila logbook hari ini belum dibuat (404 atau data kosong)
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                Hari Ini
              </span>
              <span className="text-xs text-indigo-600">•</span>
              <span className="text-xs text-indigo-700 font-medium">
                {formatDateIndonesian(today)}
              </span>
            </div>
            <h2 className="text-base font-bold text-indigo-950 mt-0.5">
              Belum Mengisi Logbook Hari Ini
            </h2>
            <p className="mt-1 text-xs text-indigo-700 max-w-xl">
              Jangan lupa mencatat aktivitas dan progres magangmu hari ini sebelum hari berakhir.
            </p>
          </div>
        </div>

        <Link
          to="/logs/new"
          className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition shrink-0"
        >
          <PenLine className="h-3.5 w-3.5" />
          <span>Tulis Logbook Sekarang</span>
        </Link>
      </div>
    </div>
  );
}
