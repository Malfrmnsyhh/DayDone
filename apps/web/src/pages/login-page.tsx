import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { GoogleLoginButton } from '../auth/google-login-button.js';

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-md">
            <span className="text-2xl font-black tracking-tight text-white">DD</span>
          </div>
        </div>
        <h1 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          DayDone
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Logbook harian mahasiswa magang — rapi, cepat, dan aman di Google Drive pribadi Anda.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-xs sm:px-10">
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Masuk ke Akun Anda
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Gunakan akun Google universitas atau pribadi Anda untuk memulai.
              </p>
            </div>

            <GoogleLoginButton />

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 space-y-2 border border-slate-100">
              <div className="flex items-start space-x-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>
                  <strong>Akses Aman & Terbatas:</strong> Izin Google Drive hanya digunakan untuk membuat folder aplikasi <code>DayDone</code> (scope <code>drive.file</code>).
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                <span>
                  Foto logbook tidak pernah disimpan permanen di server DayDone, melainkan langsung ke Google Drive Anda.
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} DayDone. Hak cipta dilindungi undang-undang.
        </p>
      </div>
    </div>
  );
}

