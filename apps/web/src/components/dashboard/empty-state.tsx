import { BookOpen, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  isFiltered?: boolean;
  onResetFilter?: () => void;
}

export function EmptyState({ isFiltered = false, onResetFilter }: EmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-3">
          <SearchX className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Tidak Ada Logbook yang Cocok
        </h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Coba periksa kembali kata kunci pencarian atau sesuaikan rentang tanggal filter Anda.
        </p>
        {onResetFilter && (
          <button
            type="button"
            onClick={onResetFilter}
            className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            Reset Seluruh Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 ring-1 ring-indigo-500/10">
        <BookOpen className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-slate-900">
        Belum Ada Logbook
      </h3>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
        Anda belum memiliki catatan logbook. Mulai catat aktivitas dan tugas magang harian Anda sekarang.
      </p>
      <div className="mt-5">
        <Link
          to="/logs/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <span>Tulis Logbook Pertama</span>
        </Link>
      </div>
    </div>
  );
}

