import { CheckCircle, Cloud, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../auth/auth-context.js';

export function DashboardPage() {
  const { user, logout } = useAuth();

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
    <div className="min-h-screen bg-slate-50">
      {/* Header bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-xs">
              DD
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              DayDone
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User'}
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-slate-900">{user?.name}</p>
                <p className="text-[11px] text-slate-500">{user?.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-red-600 transition"
              title="Keluar dari akun"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Selamat Datang, {user?.name}! 👋
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Email terdaftar: <strong>{user?.email}</strong>
              </p>
            </div>
            <div>{getDriveBadge(user?.driveStatus)}</div>
          </div>

          <hr className="my-6 border-slate-100" />

          {/* Success card for Phase A */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-emerald-900">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold">
                  Fase A Selesai — Fondasi Web & Autentikasi Berhasil!
                </h2>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Paket <code>@daydone/shared</code>, API client dengan token in-memory, proteksi CSRF, single-flight refresh token, dan route guard telah beroperasi normal.
                </p>
                <div className="mt-3 flex items-center space-x-2 text-xs text-emerald-700 font-medium">
                  <Cloud className="h-4 w-4" />
                  <span>Siap dilanjutkan ke <strong>Fase B: Fitur Logbook</strong> (Daftar, Filter, Form Buat/Ubah, Detail).</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

