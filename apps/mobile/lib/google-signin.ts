import {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
} from '@react-native-google-signin/google-signin';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let isConfigured = false;

const ensureGoogleSigninConfigured = () : void => {
    if (isConfigured) {
        return;
    }

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
        throw new Error (
            'Konfigurasi EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID belum diisi di app/mobile/.env',
        );
    }

    GoogleSignin.configure({
        webClientId,
        offlineAccess: true,
        forceCodeForRefreshToken: true,
        scopes: [DRIVE_FILE_SCOPE],
    });

    isConfigured = true;
}

export interface GoogleSignInRequestOptions {
  /**
   * Jika true (mis. saat rekoneksi Google Drive), keluar dulu dari cache SDK Google
   * agar dialog pilih akun & layar persetujuan scope drive.file muncul kembali.
   * Tidak menyentuh sesi DayDone yang sedang aktif.
   */
  forcePrompt?: boolean;
}

export const requestGoogleServerAuthCode = async (
  options: GoogleSignInRequestOptions = {},
): Promise<string | null> => {
    ensureGoogleSigninConfigured();

    try {
        await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true,
        });

        if (options.forcePrompt) {
            await signOutGoogle();
        }

        const response = await GoogleSignin.signIn();

        if (!isSuccessResponse(response)) {
            return null;
        }

        const { serverAuthCode } = response.data;
        if (!serverAuthCode) {
            throw new Error (
                'Google tidak mengembalikan kode otoritas. Pastikan web Client ID dan SHA-1 sudah benar.',
            );
        }

        return serverAuthCode;
    } catch (error: unknown) {
        if (isErrorWithCode(error)) {
            switch (error.code){
                case statusCodes.SIGN_IN_CANCELLED:
                    return null;
                case statusCodes.IN_PROGRESS:
                    throw new Error('Proses masuk dengan google masih berjalan.');
                case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                    throw new Error(
                        'Google Play Service tidak tersedia atau perlu diperbarui di perangkat ini.',
                    );
                default:
                    throw new Error(
                        `Gagal Masuk dengan Google (Kode: ${error.code}). Pastikan SHA-1 dan akun penguji terdaftar.`,
                    );
            }
        }

        if (error instanceof Error) {
            throw error;
        }

        throw new Error('terjadi kesalahan tak terduga saat masuk dengan google')
    }
}

export const signOutGoogle = async (): Promise<void> => {
    try {
        await GoogleSignin.signOut();
    } catch {

    }
}
