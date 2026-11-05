import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (newPage: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4 px-1">
      <div className="text-xs text-slate-500">
        Halaman <span className="font-semibold text-slate-900">{currentPage}</span> dari{' '}
        <span className="font-semibold text-slate-900">{totalPages}</span>
        {typeof totalItems === 'number' && (
          <span className="hidden sm:inline"> ({totalItems} total logbook)</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Sebelumnya</span>
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <span>Berikutnya</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

