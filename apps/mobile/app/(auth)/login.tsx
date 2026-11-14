import React from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const handleGoogleLoginPress = () => {
    Alert.alert(
      'Milestone M8-2',
      'Integrasi Google Sign-In native sedang disiapkan untuk M8-2. Pemilik proyek perlu mendaftarkan Android OAuth Client ID dan SHA-1 di Google Cloud Console terlebih dahulu.',
    );
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
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGoogleLoginPress}
            accessibilityRole="button"
            accessibilityLabel="Masuk dengan Google">
            <Text style={styles.googleButtonText}>Masuk dengan Google</Text>
          </Pressable>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Informasi Pengembangan</Text>
            <Text style={styles.infoDescription}>
              Fondasi client API dan manajemen token SecureStore telah siap. Tombol autentikasi Google native akan diaktifkan pada Milestone M8-2.
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
