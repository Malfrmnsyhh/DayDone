import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  HardDrive,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeleteUser } from '../api/users.js';
import { useAuth } from '../auth/auth-context.js';
import { UserAvatar } from '../components/user-avatar.js';

export function SettingsPage() {
  const { user, logout, loginWithCode, refreshUser } = useAuth();
  const navigate = useNavigate();
  const deleteUserMutation = useDeleteUser();

  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveMessage, setDriveMessage] = useState<string | null>(null);

  // Modal hapus akun state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const driveStatus = user?.driveStatus || 'NOT_CONNECTED';
  const isDriveConnected = driveStatus === 'CONNECTED';
  const isNeedsReconnect = driveStatus === 'NEEDS_RECONNECT';

  const handleDriveConnect = () => {
    setDriveMessage(null);

    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
    if (!clientId) {
      setDriveMessage('Konfigurasi VITE_GOOGLE_WEB_CLIENT_ID belum diatur.');
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setDriveMessage(
        'Google Identity Services belum siap. Silakan muat ulang halaman.',
      );
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        prompt: 'consent', // Wajib consent agar refresh token Google selalu diperbarui
        callback: async (response) => {
          if (response.code) {
            setIsConnectingDrive(true);
            try {
              await loginWithCode(response.code);
              await refreshUser();
              setDriveMessage('Izin Google Drive berhasil diperbarui!');
            } catch (err: unknown) {
              const msg =
                err instanceof Error ? err.message : 'Gagal menghubungkan Google Drive.';
              setDriveMessage(msg);
            } finally {
              setIsConnectingDrive(false);
            }
          } else if (response.error) {
            setDriveMessage(`Izin Google Drive tidak diberikan: ${response.error}`);
          }
        },
        error_callback: () => {
          setDriveMessage('Jendela otorisasi Google ditutup.');
        },
      });

      client.requestCode();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka Google login.';
      setDriveMessage(msg);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmInput.trim() !== 'HAPUS') return;

    setDeleteError(null);
    try {
      await deleteUserMutation.mutateAsync();
      setIsDeleteModalOpen(false);
      navigate('/login');
    } catch (err: any) {
      setDeleteError(err?.message || 'Gagal menghapus akun.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Tombol Kembali ke Dashboard */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Pengaturan Akun
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Kelola profil pengguna, status integrasi penyimpanan Google Drive, dan keamanan akun Anda.
        </p>
      </div>

      {/* Bagian 1: Profil Pengguna */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <UserIcon className="h-4 w-4 text-indigo-600" />
          <span>Profil Pengguna</span>
        </div>

        <div className="flex items-center space-x-4 pt-2">
          <UserAvatar
            name={user?.name}
            avatarUrl={user?.avatarUrl}
            sizeClassName="h-16 w-16 text-xl"
          />
          <div>
            <h3 className="text-base font-bold text-slate-900">{user?.name}</h3>
            <p className="text-xs sm:text-sm text-slate-500">{user?.email}</p>
            <span className="mt-1.5 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Mahasiswa Magang
            </span>
          </div>
        </div>
      </section>

      {/* Bagian 2: Integrasi Google Drive */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <HardDrive className="h-4 w-4 text-indigo-600" />
          <span>Penyimpanan Google Drive</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-800">Status Akses:</span>
              {isDriveConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Terhubung
                </span>
              ) : isNeedsReconnect ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Perlu Dihubungkan Ulang
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                  Belum Terhubung
                </span>
              )}
            </div>

            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-lg">
              {isDriveConnected
                ? 'Foto dokumentasi logbook Anda tersimpan di folder DayDone pribadi Anda di Google Drive.'
                : isNeedsReconnect
                  ? 'Izin Google Drive terputus atau kedaluwarsa. Silakan hubungkan ulang dengan memberi centang izin Google Drive.'
                  : 'Akses Google Drive belum diberikan. Hubungkan akun Google Drive untuk dapat mengunggah foto kegiatan magang.'}
            </p>

            {driveMessage && (
              <p className="mt-2 text-xs font-medium text-indigo-600">{driveMessage}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleDriveConnect}
            disabled={isConnectingDrive}
            className={`shrink-0 inline-flex items-center justify-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs transition ${
              isNeedsReconnect
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : isDriveConnected
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isConnectingDrive ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menghubungkan...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>
                  {isNeedsReconnect
                    ? 'Hubungkan Ulang'
                    : isDriveConnected
                      ? 'Perbarui Izin'
                      : 'Hubungkan Drive'}
                </span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Bagian 3: Sesi Akun */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Keluar dari Sesi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Keluar dari browser ini. Anda dapat masuk kembali kapan saja dengan akun Google.
            </p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-red-600 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </div>
      </section>

      {/* Bagian 4: Zona Berbahaya (Danger Zone) — Hapus Akun */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-red-700">
          <ShieldAlert className="h-4 w-4" />
          <span>Zona Berbahaya</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-950">Hapus Akun Permanen</h3>
            <p className="mt-1 text-xs text-red-700/90 leading-relaxed max-w-lg">
              Tindakan ini akan menghapus akun, sesi, seluruh catatan logbook, dan metadata lampiran dari database secara permanen. File foto yang sudah ada di Google Drive Anda tidak akan terhapus.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmInput('');
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
            className="shrink-0 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 transition"
          >
            <Trash2 className="h-4 w-4" />
            <span>Hapus Akun Saya</span>
          </button>
        </div>
      </section>

      {/* Modal Dialog Konfirmasi Hapus Akun Ketat */}
      {isDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteUserMutation.isPending) {
              setIsDeleteModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="rounded-xl bg-red-100 p-2.5">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="delete-account-title" className="text-base font-bold text-slate-900">
                  Konfirmasi Hapus Akun
                </h3>
                <p className="text-xs text-red-600 font-medium">Tindakan ini TIDAK dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh riwayat logbook, data akun, dan sesi login Anda akan dihapus permanen dari server DayDone.
            </p>

            <div className="space-y-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <label htmlFor="confirm-input" className="block text-xs font-semibold text-slate-700">
                Ketik kata <span className="font-mono font-bold text-red-600">HAPUS</span> di bawah untuk melanjutkan:
              </label>
              <input
                id="confirm-input"
                type="text"
                autoComplete="off"
                autoFocus
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    confirmInput.trim() === 'HAPUS' &&
                    !deleteUserMutation.isPending
                  ) {
                    e.preventDefault();
                    handleDeleteAccount();
                  } else if (e.key === 'Escape' && !deleteUserMutation.isPending) {
                    e.preventDefault();
                    setIsDeleteModalOpen(false);
                  }
                }}
                placeholder="HAPUS"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tracking-wider focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-200"
              />
            </div>

            {deleteError && (
              <p className="text-xs font-medium text-red-600">{deleteError}</p>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteUserMutation.isPending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmInput.trim() !== 'HAPUS' || deleteUserMutation.isPending}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Hapus Akun Permanen</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
