import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/auth-context.js';

interface DriveBannerProps {
  className?: string;
}

export function DriveBanner({ className = '' }: DriveBannerProps) {
  const { user, loginWithCode, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Jangan tampilkan banner jika user tidak ada atau Drive sudah terhubung (CONNECTED)
  if (!user || user.driveStatus === 'CONNECTED') {
    return null;
  }

  const isReconnect = user.driveStatus === 'NEEDS_RECONNECT';

  const handleConnectClick = () => {
    setErrorMessage(null);

    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
    if (!clientId) {
      setErrorMessage(
        'Konfigurasi VITE_GOOGLE_WEB_CLIENT_ID belum diatur.',
      );
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setErrorMessage(
        'Google Identity Services belum siap. Silakan muat ulang halaman.',
      );
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        prompt: 'consent', // Wajib consent agar Google selalu mengembalikan refresh token baru
        callback: async (response) => {
          if (response.code) {
            setIsConnecting(true);
            try {
              await loginWithCode(response.code);
              await refreshUser();
              await queryClient.invalidateQueries();
            } catch (err: unknown) {
              const msg =
                err instanceof Error ? err.message : 'Gagal menghubungkan Google Drive.';
              setErrorMessage(msg);
            } finally {
              setIsConnecting(false);
            }
          } else if (response.error) {
            setErrorMessage(`Izin Google Drive tidak diberikan: ${response.error}`);
          }
        },
        error_callback: () => {
          setErrorMessage('Jendela otorisasi Google ditutup.');
        },
      });

      client.requestCode();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses otorisasi Google.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition ${
        isReconnect
          ? 'border-amber-200 bg-amber-50/90 text-amber-900'
          : 'border-blue-200 bg-blue-50/90 text-blue-900'
      } ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start space-x-3">
          <div
            className={`mt-0.5 rounded-lg p-2 ${
              isReconnect ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isReconnect ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <HardDrive className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold">
              {isReconnect
                ? 'Akses Google Drive Perlu Dihubungkan Ulang'
                : 'Akses Google Drive Belum Terhubung'}
            </h4>
            <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
              {isReconnect
                ? 'Sesi atau izin Google Drive telah kedaluwarsa. Hubungkan ulang dengan memberi centang izin Google Drive agar foto lampiran dapat disimpan.'
                : 'DayDone menyimpan foto dokumentasi langsung di folder Google Drive pribadi Anda. Hubungkan akun dan centang izin Drive untuk mulai mengunggah foto.'}
            </p>
            {errorMessage && (
              <p className="mt-2 text-xs font-medium text-rose-600">{errorMessage}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={handleConnectClick}
            disabled={isConnecting}
            className={`inline-flex w-full items-center justify-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs transition sm:w-auto sm:text-sm ${
              isReconnect
                ? 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
            } focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menghubungkan...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>{isReconnect ? 'Hubungkan Ulang Drive' : 'Hubungkan Google Drive'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

