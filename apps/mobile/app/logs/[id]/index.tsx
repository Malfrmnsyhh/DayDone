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
import { useQueryClient } from '@tanstack/react-query';
import { MAX_ATTACHMENTS } from '@daydone/shared';
import { DriveReconnectBanner } from '@/components/drive-banner';
import { useAuth } from '@/lib/auth-store';
import {
  runSequentialUploadQueue,
  type SelectedImageFile,
  uploadAttachmentXHR,
  type UploadQueueItem,
  useDeleteAttachment,
  validateSelectedImages,
} from '@/lib/attachments-api';
import { formatDateIndonesian } from '@/lib/date';
import { pickImageFromCamera, pickImagesFromGallery } from '@/lib/image-picker';
import { isNotFoundError, useDeleteLog, useLogDetail } from '@/lib/logs-api';

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const logId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: log,
    isLoading,
    isError,
    error,
    refetch,
  } = useLogDetail(logId);
  const deleteLog = useDeleteLog();
  const deleteAttachment = useDeleteAttachment();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);

  // Menyimpan ID lampiran yang sudah pernah memicu refetch akibat signed URL kedaluwarsa
  const retriedAttachmentIdsRef = useRef<Set<string>>(new Set());

  const sortedAttachments = useMemo(() => {
    if (!log?.attachments) return [];
    return [...log.attachments].sort((a, b) => a.position - b.position);
  }, [log?.attachments]);

  const remainingQuota = Math.max(
    0,
    MAX_ATTACHMENTS - sortedAttachments.length,
  );
  const isDriveConnected = user?.driveStatus === 'CONNECTED';
  const canAddPhotos =
    isDriveConnected &&
    remainingQuota > 0 &&
    !isUploading &&
    !deleteLog.isPending;

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

  const enqueueAndUploadFiles = async (selectedFiles: SelectedImageFile[]) => {
    if (!log || selectedFiles.length === 0) {
      return;
    }

    const validation = validateSelectedImages(
      selectedFiles,
      sortedAttachments.length,
    );
    setValidationWarnings(validation.errors);

    if (validation.accepted.length === 0) {
      return;
    }

    const batchPrefix = `${Date.now()}`;
    const newItems: UploadQueueItem[] = validation.accepted.map(
      (file, index) => ({
        id: `${batchPrefix}-${index}`,
        fileName: file.name,
        file,
        status: 'pending',
        progress: 0,
      }),
    );

    setUploadQueue((prev) => [
      ...prev.filter((item) => item.status === 'error'),
      ...newItems,
    ]);
    setIsUploading(true);

    try {
      await runSequentialUploadQueue({
        items: newItems,
        uploadFn: (file, onProgress) =>
          uploadAttachmentXHR(log.id, file, onProgress),
        onItemUpdate: (itemId, patch) => {
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          );
        },
        onAnySuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['logs'] });
        },
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraPress = async () => {
    if (!canAddPhotos) return;
    setValidationWarnings([]);
    const picked = await pickImageFromCamera();
    if (picked) {
      await enqueueAndUploadFiles([picked]);
    }
  };

  const handleGalleryPress = async () => {
    if (!canAddPhotos) return;
    setValidationWarnings([]);
    const pickedList = await pickImagesFromGallery(remainingQuota);
    if (pickedList.length > 0) {
      await enqueueAndUploadFiles(pickedList);
    }
  };

  const handleDismissQueueItem = (itemId: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleDeleteAttachmentPress = (attachmentId: string) => {
    Alert.alert(
      'Hapus Foto Dokumentasi?',
      'Foto ini akan dihapus dari logbook dan file aslinya di Google Drive akan dipindahkan ke Sampah (Trash).',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Foto',
          style: 'destructive',
          onPress: async () => {
            setDeletingAttachmentId(attachmentId);
            try {
              await deleteAttachment.mutateAsync(attachmentId);
              if (selectedAttachment?.id === attachmentId) {
                setSelectedIndex(null);
              }
            } catch (err: unknown) {
              const message =
                err instanceof Error
                  ? err.message
                  : 'Gagal menghapus foto. Silakan coba lagi.';
              Alert.alert('Gagal Menghapus Foto', message);
            } finally {
              setDeletingAttachmentId(null);
            }
          },
        },
      ],
    );
  };

  const handleEditPress = () => {
    if (!log) return;
    router.push({
      pathname: '/logs/[id]/edit',
      params: { id: log.id },
    });
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

        {/* Galeri Foto Dokumentasi & Unggah */}
        <View style={styles.card}>
          <View style={styles.galleryHeader}>
            <Text style={styles.sectionTitle}>Foto Dokumentasi</Text>
            <Text style={styles.quotaText}>
              {sortedAttachments.length}/{MAX_ATTACHMENTS} foto tersimpan
              {remainingQuota > 0
                ? ` (sisa kuota: ${remainingQuota})`
                : ' (kuota penuh)'}
            </Text>
          </View>

          <Text style={styles.privacyNote}>
            Format JPEG, PNG, atau WebP (maks. 10 MB/foto). Metadata EXIF & lokasi GPS otomatis dihapus saat unggah demi privasi.
          </Text>

          {/* Banner Rekoneksi Google Drive (langsung bisa rekoneksi dari halaman detail) */}
          <DriveReconnectBanner />

          {/* Tombol Tambah Foto (Kamera & Galeri) */}
          <View style={styles.uploadActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.uploadActionButton,
                !canAddPhotos && styles.disabled,
                pressed && canAddPhotos && styles.pressed,
              ]}
              onPress={() => void handleCameraPress()}
              disabled={!canAddPhotos}
              accessibilityRole="button"
              accessibilityLabel="Ambil foto dari kamera">
              <Text style={styles.uploadActionText}>Ambil Foto (Kamera)</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.uploadActionButton,
                !canAddPhotos && styles.disabled,
                pressed && canAddPhotos && styles.pressed,
              ]}
              onPress={() => void handleGalleryPress()}
              disabled={!canAddPhotos}
              accessibilityRole="button"
              accessibilityLabel="Pilih foto dari galeri">
              <Text style={styles.uploadActionText}>Pilih dari Galeri</Text>
            </Pressable>
          </View>

          {remainingQuota === 0 && isDriveConnected && (
            <Text style={styles.quotaFullNote}>
              Kuota {MAX_ATTACHMENTS}/{MAX_ATTACHMENTS} foto sudah penuh. Hapus foto lama bila ingin menambahkan foto baru.
            </Text>
          )}

          {/* Peringatan Validasi Sisi Klien */}
          {validationWarnings.length > 0 && (
            <View style={styles.warningListBox} accessibilityRole="alert">
              <View style={styles.warningHeaderRow}>
                <Text style={styles.warningTitle}>Beberapa foto tidak diproses:</Text>
                <Pressable
                  style={styles.dismissMiniButton}
                  onPress={() => setValidationWarnings([])}
                  accessibilityRole="button"
                  accessibilityLabel="Tutup pesan peringatan validasi">
                  <Text style={styles.dismissMiniText}>Tutup</Text>
                </Pressable>
              </View>
              {validationWarnings.map((warning, idx) => (
                <Text key={`${warning}-${idx}`} style={styles.warningItemText}>
                  • {warning}
                </Text>
              ))}
            </View>
          )}

          {/* Antrean Unggah Aktif (Sequential XHR Progress) */}
          {uploadQueue.length > 0 && (
            <View style={styles.queueSection}>
              <Text style={styles.queueSectionTitle}>Status Unggahan</Text>
              {uploadQueue.map((item) => {
                const statusLabel =
                  item.status === 'pending'
                    ? 'Menunggu...'
                    : item.status === 'uploading'
                      ? `Mengunggah ${item.progress}%`
                      : item.status === 'done'
                        ? 'Selesai'
                        : 'Gagal';

                return (
                  <View key={item.id} style={styles.queueItem}>
                    <View style={styles.queueItemHeader}>
                      <Text style={styles.queueFileName} numberOfLines={1}>
                        {item.fileName}
                      </Text>
                      <Text
                        style={[
                          styles.queueStatusText,
                          item.status === 'done' && styles.queueStatusDone,
                          item.status === 'error' && styles.queueStatusError,
                        ]}>
                        {statusLabel}
                      </Text>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          item.status === 'done' && styles.progressFillDone,
                          item.status === 'error' && styles.progressFillError,
                          { width: `${item.progress}%` },
                        ]}
                      />
                    </View>

                    {item.errorMessage && (
                      <Text style={styles.queueErrorText}>
                        {item.errorMessage}
                      </Text>
                    )}

                    {(item.status === 'done' || item.status === 'error') && (
                      <Pressable
                        style={styles.dismissQueueButton}
                        onPress={() => handleDismissQueueItem(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Tutup status unggah ${item.fileName}`}>
                        <Text style={styles.dismissQueueText}>Tutup</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Grid Thumbnail Galeri Foto */}
          {sortedAttachments.length === 0 ? (
            <Text style={styles.emptyGalleryText}>
              Belum ada foto dokumentasi pada logbook ini.
            </Text>
          ) : (
            <View style={styles.galleryGrid}>
              {sortedAttachments.map((attachment, index) => {
                const isDeletingThis = deletingAttachmentId === attachment.id;
                return (
                  <View key={attachment.id} style={styles.thumbnailCard}>
                    <Pressable
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

                    <Pressable
                      style={({ pressed }) => [
                        styles.thumbnailDeleteButton,
                        (isDeletingThis || isUploading) && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                      disabled={isDeletingThis || isUploading}
                      onPress={() => handleDeleteAttachmentPress(attachment.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus foto dokumentasi ke-${index + 1}`}>
                      {isDeletingThis ? (
                        <ActivityIndicator size="small" color="#B91C1C" />
                      ) : (
                        <Text style={styles.thumbnailDeleteText}>
                          Hapus Foto
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Tombol Aksi */}
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              (deleteLog.isPending || isUploading) && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={handleEditPress}
            disabled={deleteLog.isPending || isUploading}
            accessibilityRole="button"
            accessibilityLabel="Ubah logbook">
            <Text style={styles.editButtonText}>Ubah Logbook</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
              (deleteLog.isPending || isUploading) && styles.disabled,
            ]}
            onPress={handleDeletePress}
            disabled={deleteLog.isPending || isUploading}
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
            <View style={styles.modalHeaderActions}>
              {selectedAttachment && (
                <Pressable
                  style={[
                    styles.modalDeleteButton,
                    deletingAttachmentId === selectedAttachment.id &&
                      styles.disabled,
                  ]}
                  disabled={deletingAttachmentId === selectedAttachment.id}
                  onPress={() =>
                    handleDeleteAttachmentPress(selectedAttachment.id)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Hapus foto yang sedang ditampilkan">
                  <Text style={styles.modalDeleteText}>Hapus</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setSelectedIndex(null)}
                accessibilityRole="button"
                accessibilityLabel="Tutup tampilan penuh foto">
                <Text style={styles.modalCloseText}>Tutup</Text>
              </Pressable>
            </View>
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
  galleryHeader: {
    marginBottom: 6,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  quotaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  privacyNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 12,
  },
  driveWarningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  driveWarningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  uploadActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  uploadActionButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
    textAlign: 'center',
  },
  quotaFullNote: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  warningListBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  warningItemText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 17,
  },
  dismissMiniButton: {
    minHeight: 32,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  dismissMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  queueSection: {
    gap: 8,
    marginBottom: 14,
  },
  queueSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  queueItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  queueItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  queueFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  queueStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  queueStatusDone: {
    color: '#15803D',
  },
  queueStatusError: {
    color: '#DC2626',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0284C7',
  },
  progressFillDone: {
    backgroundColor: '#16A34A',
  },
  progressFillError: {
    backgroundColor: '#DC2626',
  },
  queueErrorText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 17,
  },
  dismissQueueButton: {
    alignSelf: 'flex-end',
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissQueueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
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
  thumbnailCard: {
    width: '48%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbnailWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5F9',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailDeleteButton: {
    minHeight: 44,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  thumbnailDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
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
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalCounter: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
