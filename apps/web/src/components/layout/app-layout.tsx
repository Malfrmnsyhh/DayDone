import { LogOut, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context.js';
import { UserAvatar } from '../user-avatar.js';

export function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // Scroll ke atas halaman saat rute berpindah
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const getDriveBadge = (status?: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            Drive Terhubung
          </span>
        );
      case 'NEEDS_RECONNECT':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
            Perlu Hubungkan Ulang
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
            Belum Terhubung
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Tautan Aksesibilitas: Lewati ke konten utama */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-md focus:outline-hidden"
      >
        Lewati ke konten utama
      </a>

      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center space-x-2.5 hover:opacity-90 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-xs">
              DD
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              DayDone
            </span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden sm:block">{getDriveBadge(user?.driveStatus)}</div>

            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 transition"
              title="Buka pengaturan akun"
            >
              <UserAvatar
                name={user?.name}
                avatarUrl={user?.avatarUrl}
                sizeClassName="h-8 w-8 text-xs"
              />
              <div className="hidden text-left md:block">
                <p className="text-xs font-semibold text-slate-900 leading-tight">
                  {user?.name}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {user?.email}
                </p>
              </div>
            </Link>

            <Link
              to="/settings"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 transition"
              title="Pengaturan akun"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-red-600 transition"
              title="Keluar dari akun"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="mx-auto max-w-5xl w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <p>
            DayDone &copy; {new Date().getFullYear()} &mdash; Logbook Magang Harian
          </p>
          <p className="text-[11px] text-slate-400">
            Foto tersimpan privat di Google Drive pribadi Anda
          </p>
        </div>
      </footer>
    </div>
  );
}

