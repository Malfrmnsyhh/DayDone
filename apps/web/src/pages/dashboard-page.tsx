import { Plus } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useLogsList } from '../api/logs.js';
import { ErrorState } from '../components/common/error-state.js';
import { ListSkeleton } from '../components/common/loading-skeleton.js';
import { EmptyState } from '../components/dashboard/empty-state.js';
import { LogCard } from '../components/dashboard/log-card.js';
import { LogFilterBar } from '../components/dashboard/log-filter-bar.js';
import { Pagination } from '../components/dashboard/pagination.js';
import { TodayCard } from '../components/dashboard/today-card.js';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const search = searchParams.get('search') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  const { data, isLoading, isError, refetch } = useLogsList({
    page,
    limit: 10,
    search,
    from,
    to,
  });

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetFilter = () => {
    setSearchParams(new URLSearchParams({ page: '1' }));
  };

  const hasFilters = Boolean(search || from || to);
  const logs = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      {/* Kartu Hari Ini */}
      <TodayCard />

      {/* Header Daftar Logbook */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Daftar Logbook
          </h1>
          <p className="text-xs text-slate-500">
            Riwayat seluruh catatan aktivitas dan tugas magang Anda.
          </p>
        </div>

        <Link
          to="/logs/new"
          className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Tulis Logbook</span>
        </Link>
      </div>

      {/* Filter & Pencarian */}
      <LogFilterBar />

      {/* Area Konten Daftar */}
      {isLoading && <ListSkeleton count={4} />}

      {isError && (
        <ErrorState
          title="Gagal Memuat Logbook"
          message="Tidak dapat mengambil daftar logbook dari server. Pastikan API backend aktif."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && logs.length === 0 && (
        <EmptyState
          isFiltered={hasFilters}
          onResetFilter={handleResetFilter}
        />
      )}

      {!isLoading && !isError && logs.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-3">
            {logs.map((log) => (
              <LogCard key={log.id} log={log} />
            ))}
          </div>

          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
