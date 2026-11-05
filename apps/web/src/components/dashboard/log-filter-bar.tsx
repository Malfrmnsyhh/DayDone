import { Calendar, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTodayLocalDateString } from '../../lib/date.js';

export function LogFilterBar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = getTodayLocalDateString();

  const urlSearch = searchParams.get('search') || '';
  const urlFrom = searchParams.get('from') || '';
  const urlTo = searchParams.get('to') || '';

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Sync internal state when URL changes externally (e.g. back button)
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // Debounce search update to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      const currentInUrl = searchParams.get('search') || '';
      if (trimmed !== currentInUrl) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) {
            next.set('search', trimmed);
          } else {
            next.delete('search');
          }
          next.set('page', '1'); // Reset ke halaman 1
          return next;
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  const handleFromChange = (newFrom: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newFrom) {
        next.set('from', newFrom);
      } else {
        next.delete('from');
      }
      next.set('page', '1');
      return next;
    });
  };

  const handleToChange = (newTo: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newTo) {
        next.set('to', newTo);
      } else {
        next.delete('to');
      }
      next.set('page', '1');
      return next;
    });
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      next.delete('from');
      next.delete('to');
      next.set('page', '1');
      return next;
    });
  };

  const hasActiveFilters = Boolean(urlSearch || urlFrom || urlTo);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari deskripsi logbook..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
        />
      </div>

      {/* Date Range Inputs */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            aria-label="Dari tanggal"
            max={today}
            value={urlFrom}
            onChange={(e) => handleFromChange(e.target.value)}
            className="bg-transparent text-xs text-slate-700 outline-none"
          />
        </div>

        <span className="text-xs text-slate-400 font-medium">s/d</span>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            aria-label="Sampai tanggal"
            max={today}
            value={urlTo}
            onChange={(e) => handleToChange(e.target.value)}
            className="bg-transparent text-xs text-slate-700 outline-none"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            title="Reset seluruh filter"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

