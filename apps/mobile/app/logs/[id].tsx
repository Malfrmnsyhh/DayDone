import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MAX_ATTACHMENTS } from '@daydone/shared';
import { formatDateIndonesian } from '@/lib/date';
import { isNotFoundError, useDeleteLog, useLogDetail } from '@/lib/logs-api';

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const logId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();

  const {
    data: log,
    isLoading,
    isError,
    error,
    refetch,
  } = useLogDetail(logId);
  const deleteLog = useDeleteLog();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Menyimpan ID lampiran yang sudah pernah memicu refetch akibat signed URL kedaluwarsa
  const retriedAttachmentIdsRef = useRef<Set<string>>(new Set());

  const sortedAttachments = useMemo(() => {
    if (!log?.attachments) return [];
    return [...log.attachments].sort((a, b) => a.position - b.position);
  }, [log?.attachments]);

  const selectedAttachment =
    selectedIndex !== null ? sortedAttachments[selectedIndex] ?? null : null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      retriedAttachmentIdsRef.current.clear();
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImageError = (attachmentId: string) => {
    // Fail-safe: refetch detail tepat 1x per lampiran bila signed URL kedaluwarsa (> 5 menit)
    if (retriedAttachmentIdsRef.current.has(attachmentId)) {
      return;
    }
    retriedAttachmentIdsRef.current.add(attachmentId);
    void refetch();
  };

  const handleEditPress = () => {
    Alert.alert(
      'Segera Hadir (M8-5)',
      'Form ubah logbook dan unggah foto akan dibangun di tahap M8-5.',
    );
  };

  const handleDeletePress = () => {
    if (!log) return;

    Alert.alert(
      'Hapus Logbook?',
      'Catatan logbook ini akan dihapus permanen. Foto dokumentasi terkait di Google Drive akan dipindahkan ke Sampah.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLog.mutateAsync(log.id);
              router.back();
            } catch (err: unknown) {
              const message =
                err instanceof Error
                  ? err.message
                  : 'Gagal menghapus logbook. Silakan coba lagi.';
              Alert.alert('Gagal Menghapus', message);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.stateText}>Memuat detail logbook...</Text>
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
            Logbook ini mungkin sudah dihapus atau tautannya tidak valid.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke daftar logbook">
            <Text style={styles.primaryButtonText}>Kembali</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !log) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.stateTitle}>Gagal Memuat Detail</Text>
          <Text style={styles.stateText}>
            {error instanceof Error
              ? error.message
              : 'Terjadi kesalahan saat menghubungi server.'}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Coba lagi memuat detail">
            <Text style={styles.primaryButtonText}>Coba Lagi</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
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
        {/* Header Tanggal & Info Foto */}
        <View style={styles.card}>
          <Text style={styles.dateTitle}>{formatDateIndonesian(log.date)}</Text>
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {sortedAttachments.length} / {MAX_ATTACHMENTS} Foto
              </Text>
            </View>
            <Text style={styles.hintText}>Tekan lama teks untuk menyalin</Text>
          </View>

          <View style={styles.divider} />

          {/* Deskripsi teks murni (selectable agar mudah disalin ke laporan magang) */}
          <Text style={styles.description} selectable>
            {log.description}
          </Text>
        </View>

        {/* Galeri Foto Dokumentasi */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Foto Dokumentasi</Text>
          {sortedAttachments.length === 0 ? (
            <Text style={styles.emptyGalleryText}>
              Belum ada foto dokumentasi pada logbook ini.
            </Text>
          ) : (
            <View style={styles.galleryGrid}>
              {sortedAttachments.map((attachment, index) => (
                <Pressable
                  key={attachment.id}
                  style={({ pressed }) => [
                    styles.thumbnailWrapper,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setSelectedIndex(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Buka foto dokumentasi ke-${index + 1}`}>
                  <Image
                    source={{ uri: attachment.url }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                    onError={() => handleImageError(attachment.id)}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Tombol Aksi */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
            onPress={handleEditPress}
            disabled={deleteLog.isPending}
            accessibilityRole="button"
            accessibilityLabel="Ubah logbook">
            <Text style={styles.editButtonText}>Ubah Logbook</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
              deleteLog.isPending && styles.disabled,
            ]}
            onPress={handleDeletePress}
            disabled={deleteLog.isPending}
            accessibilityRole="button"
            accessibilityLabel="Hapus logbook">
            {deleteLog.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteButtonText}>Hapus</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Lightbox Modal Layar Penuh */}
      <Modal
        visible={selectedAttachment !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}>
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalCounter}>
              {selectedIndex !== null
                ? `${selectedIndex + 1} / ${sortedAttachments.length}`
                : ''}
            </Text>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedIndex(null)}
              accessibilityRole="button"
              accessibilityLabel="Tutup tampilan penuh foto">
              <Text style={styles.modalCloseText}>Tutup</Text>
            </Pressable>
          </View>

          <View style={styles.modalImageContainer}>
            {selectedAttachment && (
              <Image
                source={{ uri: selectedAttachment.url }}
                style={styles.modalImage}
                resizeMode="contain"
                onError={() => handleImageError(selectedAttachment.id)}
              />
            )}
          </View>

          {sortedAttachments.length > 1 && selectedIndex !== null && (
            <View style={styles.modalFooter}>
              <Pressable
                style={[
                  styles.modalNavButton,
                  selectedIndex === 0 && styles.disabled,
                ]}
                disabled={selectedIndex === 0}
                onPress={() => setSelectedIndex(selectedIndex - 1)}
                accessibilityRole="button"
                accessibilityLabel="Foto sebelumnya">
                <Text style={styles.modalNavText}>← Sebelumnya</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalNavButton,
                  selectedIndex === sortedAttachments.length - 1 &&
                    styles.disabled,
                ]}
                disabled={selectedIndex === sortedAttachments.length - 1}
                onPress={() => setSelectedIndex(selectedIndex + 1)}
                accessibilityRole="button"
                accessibilityLabel="Foto berikutnya">
                <Text style={styles.modalNavText}>Berikutnya →</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  description: {
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 23,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  emptyGalleryText: {
    fontSize: 13,
    color: '#64748B',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbnailWrapper: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  editButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    minWidth: 104,
    minHeight: 48,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCounter: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  modalNavButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNavText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});