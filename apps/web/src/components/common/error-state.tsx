import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Terjadi Kesalahan',
  message = 'Gagal memuat data. Periksa koneksi internet Anda atau pastikan server API sedang aktif.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center text-red-900 ${className}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-red-700 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Coba Lagi</span>
        </button>
      )}
    </div>
  );
}

