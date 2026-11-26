import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-store';
import { formatDateIndonesian, getTodayLocalDateString } from '@/lib/date';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  const todayFormatted = formatDateIndonesian(getTodayLocalDateString());

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Profil Singkat */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Halo,</Text>
            <Text style={styles.userName}>
              {user?.name || 'Mahasiswa Magang'}
            </Text>
          </View>
          <Pressable
            style={styles.logoutButton}
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Keluar">
            <Text style={styles.logoutText}>Keluar</Text>
          </Pressable>
        </View>

        <Text style={styles.dateText}>{todayFormatted}</Text>

        {/* Card Status Hari Ini (fondasi M8-3) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Status Logbook Hari Ini</Text>
            <View style={styles.badgePending}>
              <Text style={styles.badgeText}>Belum Diisi</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            Catat kegiatan magang dan pencapaian kerjamu hari ini sebelum pulang agar tidak terlupa.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              // Navigasi ke form logbook di M8-5
            }}>
            <Text style={styles.primaryButtonText}>+ Tulis Logbook Cepat</Text>
          </Pressable>
        </View>

        {/* Card Info Integrasi Drive */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Status Google Drive</Text>
          <Text style={styles.infoText}>
            {user?.driveStatus === 'CONNECTED'
              ? 'Terhubung — Foto dokumentasi akan otomatis tersimpan di folder DayDone Drive Anda.'
              : 'Belum terhubung — Foto logbook membutuhkan izin akses Google Drive.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  dateText: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#0C4A6E',
    lineHeight: 18,
  },
});
