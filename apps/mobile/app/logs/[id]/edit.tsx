import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CreateLogDto } from '@daydone/shared';
import { LogForm } from '@/components/log-form';
import {
  getLogDateConflict,
  isNotFoundError,
  type LogDateConflictInfo,
  useLogDetail,
  useUpdateLog,
} from '@/lib/logs-api';

export default function EditLogScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const logId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();

  const {
    data: detailLog,
    isLoading,
    isError,
    error,
    refetch,
  } = useLogDetail(logId);
  const updateLog = useUpdateLog();

  const [conflictError, setConflictError] =
    useState<LogDateConflictInfo | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleClearServerError = () => {
    setConflictError(null);
    setSubmitError(null);
  };

  const handleSubmit = async (data: CreateLogDto): Promise<boolean> => {
    if (!logId) return false;
    handleClearServerError();

    try {
      const updated = await updateLog.mutateAsync({
        id: logId,
        dto: {
          date: data.date,
          description: data.description,
        },
      });
      router.replace({ pathname: '/logs/[id]', params: { id: updated.id } });
      return true;
    } catch (err: unknown) {
      const conflict = getLogDateConflict(err);
      if (conflict) {
        setConflictError(conflict);
        return false;
      }

      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan perubahan. Pastikan koneksi ke server aktif.',
      );
      return false;
    }
  };

  const handleOpenConflictLog = (existingLogId: string) => {
    router.replace({ pathname: '/logs/[id]', params: { id: existingLogId } });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.stateText}>Memuat data logbook...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError && isNotFoundError(error)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.stateTitle}>Logbook Tidak Ditemukan</Text>
          <Text style={styles.stateText}>
            Logbook yang ingin kamu ubah mungkin sudah dihapus.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Kembali">
            <Text style={styles.primaryButtonText}>Kembali</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !detailLog) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.stateTitle}>Gagal Memuat Logbook</Text>
          <Text style={styles.stateText}>
            {error instanceof Error
              ? error.message
              : 'Terjadi kesalahan saat menghubungi server.'}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Coba lagi memuat logbook">
            <Text style={styles.primaryButtonText}>Coba Lagi</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LogForm
      key={detailLog.id}
      mode="edit"
      initialDate={detailLog.date}
      initialDescription={detailLog.description}
      isSubmitting={updateLog.isPending}
      conflictError={conflictError}
      submitError={submitError}
      onClearServerError={handleClearServerError}
      onSubmit={handleSubmit}
      onOpenConflictLog={handleOpenConflictLog}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
