import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-store';
import { requestGoogleServerAuthCode } from '@/lib/google-signin';

export default function LoginScreen() {
  const { loginWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLoginPress = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const serverAuthCode = await requestGoogleServerAuthCode();
      if (!serverAuthCode) {
        // Pengguna membatalkan dialog Google sendiri
        return;
      }

      await loginWithGoogle(serverAuthCode);
      // Jika sukses, RootLayoutNavigation di app/_layout.tsx
      // otomatis mengarahkan user ke /(tabs)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal masuk dengan Google. Silakan coba lagi.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>DayDone</Text>
          <Text style={styles.tagline}>
            Logbook Harian Mahasiswa Magang
          </Text>
          <Text style={styles.subtext}>
            Catat kegiatan harianmu dengan cepat dan simpan dokumentasi foto langsung di Google Drive pribadimu.
          </Text>
        </View>

        <View style={styles.actionContainer}>
          {errorMessage && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && !isSubmitting && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleGoogleLoginPress}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Masuk dengan Google">
            {isSubmitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.googleButtonText}>Memproses...</Text>
              </View>
            ) : (
              <Text style={styles.googleButtonText}>Masuk dengan Google</Text>
            )}
          </Pressable>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Privasi Penyimpanan</Text>
            <Text style={styles.infoDescription}>
              DayDone hanya meminta izin untuk membuat dan mengelola foto dokumentasi di folder DayDone pada Google Drive pribadimu.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  header: {
    marginTop: 40,
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actionContainer: {
    width: '100%',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  googleButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
});