import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NotFoundStateProps {
  title?: string;
  message?: string;
  backTo?: string;
  backText?: string;
}

export function NotFoundState({
  title = 'Logbook Tidak Ditemukan',
  message = 'Logbook yang Anda cari tidak ada atau mungkin sudah dihapus.',
  backTo = '/',
  backText = 'Kembali ke Dashboard',
}: NotFoundStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 ring-1 ring-amber-500/10">
        <FileQuestion className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{message}</p>
      <div className="mt-6">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{backText}</span>
        </Link>
      </div>
    </div>
  );
}

