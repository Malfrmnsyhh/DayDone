import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';
import {
  formatDateIndonesian,
  formatMonthYearIndonesian,
  getCurrentLocalMonthString,
  getTodayLocalDateString,
} from '@/lib/date';
import { getDriveStatusInfo } from '@/lib/drive-status';
import { useLogByDate, useLogStats } from '@/lib/logs-api';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = getTodayLocalDateString();
  const currentMonth = getCurrentLocalMonthString();

  const todayFormatted = formatDateIndonesian(today);
  const monthLabel = formatMonthYearIndonesian(currentMonth);
  const driveInfo = getDriveStatusInfo(user?.driveStatus);
  const isDriveWarning = driveInfo.tone === 'warning';

  const {
    data: todayLog,
    isLoading: isTodayLoading,
    isError: isTodayError,
    refetch: refetchToday,
  } = useLogByDate(today);

  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useLogStats(currentMonth);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchToday(), refetchStats()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickWritePress = () => {
    Alert.alert(
      'Segera Hadir (M8-5)',
      'Form buat logbook & ambil foto akan kita bangun di tahap M8-5.',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#0284C7']}
            tintColor="#0284C7"
          />
        }>
        {/* Header Profil Singkat */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Halo,</Text>
            <Text style={styles.userName} numberOfLines={1}>
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

        {/* Kartu Status Logbook Hari Ini */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Status Logbook Hari Ini</Text>
            {!isTodayLoading && !isTodayError && (
              <View
                style={todayLog ? styles.badgeDone : styles.badgePending}>
                <Text
                  style={
                    todayLog ? styles.badgeTextDone : styles.badgeTextPending
                  }>
                  {todayLog ? 'Sudah Diisi' : 'Belum Diisi'}
                </Text>
              </View>
            )}
          </View>

          {isTodayLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#0284C7" />
              <Text style={styles.loadingText}>Memuat status hari ini...</Text>
            </View>
          ) : isTodayError ? (
            <View>
              <Text style={styles.errorText}>
                Gagal memuat status logbook hari ini. Pastikan koneksi ke server aktif.
              </Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => refetchToday()}
                accessibilityRole="button"
                accessibilityLabel="Coba lagi muat status hari ini">
                <Text style={styles.secondaryButtonText}>Coba Lagi</Text>
              </Pressable>
            </View>
          ) : todayLog ? (
            <View>
              <Text style={styles.logSnippet} numberOfLines={3}>
                {todayLog.description}
              </Text>
              <Text style={styles.metaText}>
                {todayLog.attachmentCount > 0
                  ? `${todayLog.attachmentCount} foto dokumentasi terlampir`
                  : 'Belum ada foto dokumentasi'}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Lihat riwayat logbook"
                onPress={() => router.push('/(tabs)/logs')}>
                <Text style={styles.secondaryButtonText}>
                  Lihat di Riwayat Logbook
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.cardDesc}>
                Catat kegiatan magang dan pencapaian kerjamu hari ini sebelum pulang agar tidak terlupa.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Tulis logbook cepat"
                onPress={handleQuickWritePress}>
                <Text style={styles.primaryButtonText}>
                  + Tulis Logbook Cepat
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Kartu Ringkasan Bulan Ini */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ringkasan {monthLabel}</Text>
          {isStatsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#0284C7" />
              <Text style={styles.loadingText}>Memuat ringkasan...</Text>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {stats?.totalThisMonth ?? 0}
                </Text>
                <Text style={styles.statLabel}>Bulan Ini</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {stats?.totalAllTime ?? 0}
                </Text>
                <Text style={styles.statLabel}>Total Logbook</Text>
              </View>
            </View>
          )}
        </View>

        {/* Kartu Info Integrasi Drive */}
        <View
          style={[
            styles.infoCard,
            isDriveWarning && styles.infoCardWarning,
          ]}>
          <Text
            style={[
              styles.infoTitle,
              isDriveWarning && styles.infoTitleWarning,
            ]}>
            {driveInfo.title}
          </Text>
          <Text
            style={[
              styles.infoText,
              isDriveWarning && styles.infoTextWarning,
            ]}>
            {driveInfo.description}
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  headerText: {
    flex: 1,
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
    marginBottom: 12,
    gap: 8,
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
  badgeTextPending: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeDone: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTextDone: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
    lineHeight: 19,
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 16,
  },
  logSnippet: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 11,
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
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0284C7',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
  },
  infoCardWarning: {
    backgroundColor: '#FFFBEB',
    borderLeftColor: '#D97706',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4,
  },
  infoTitleWarning: {
    color: '#B45309',
  },
  infoText: {
    fontSize: 12,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  infoTextWarning: {
    color: '#92400E',
  },
});