import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';
import { getDriveStatusInfo } from '@/lib/drive-status';
import {
  getDeleteAccountErrorMessage,
  getUserInitials,
  isDeleteConfirmationValid,
  useDeleteAccount,
} from '@/lib/users-api';

export default function SettingsScreen() {
  const { user, reconnectGoogleDrive, logout } = useAuth();
  const router = useRouter();
  const deleteAccount = useDeleteAccount();

  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // State Modal Danger Zone (Hapus Akun)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset error avatar bila URL foto profil berubah
  useEffect(() => {
    setAvatarLoadError(false);
  }, [user?.avatarUrl]);

  const driveInfo = getDriveStatusInfo(user?.driveStatus);
  const initials = getUserInitials(user?.name, user?.email);
  const canConfirmDelete =
    isDeleteConfirmationValid(confirmInput) && !deleteAccount.isPending;

  const handleReconnectDrivePress = async () => {
    if (isReconnecting) return;
    setDriveError(null);
    setDriveSuccess(null);
    setIsReconnecting(true);

    try {
      const outcome = await reconnectGoogleDrive();
      if (outcome === 'connected') {
        setDriveSuccess('Google Drive berhasil terhubung.');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menghubungkan Google Drive. Silakan coba lagi.';
      setDriveError(message);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleLogoutPress = () => {
    if (isLoggingOut) return;

    Alert.alert(
      'Keluar dari DayDone?',
      'Sesi di perangkat ini akan diakhiri. Data logbook dan foto kamu tetap aman tersimpan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenDeleteModal = () => {
    setConfirmInput('');
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (deleteAccount.isPending) return;
    setIsDeleteModalOpen(false);
    setConfirmInput('');
    setDeleteError(null);
  };

  const handleExecuteDeleteAccount = async () => {
    if (!canConfirmDelete) return;
    setDeleteError(null);

    try {
      await deleteAccount.mutateAsync(confirmInput);
      setIsDeleteModalOpen(false);
      router.replace('/(auth)/login');
    } catch (error: unknown) {
      setDeleteError(getDeleteAccountErrorMessage(error));
    }
  };

  const badgeContainerStyle =
    driveInfo.tone === 'connected'
      ? styles.badgeConnected
      : driveInfo.tone === 'warning'
        ? styles.badgeWarning
        : styles.badgeNeutral;

  const badgeTextStyle =
    driveInfo.tone === 'connected'
      ? styles.badgeTextConnected
      : driveInfo.tone === 'warning'
        ? styles.badgeTextWarning
        : styles.badgeTextNeutral;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Akun & Pengaturan</Text>
          <Text style={styles.screenSubtitle}>
            Kelola profil, koneksi Google Drive, sesi, dan akun DayDone Anda.
          </Text>
        </View>

        {/* Kartu Profil Pengguna */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profil Pengguna</Text>
          <View style={styles.profileRow}>
            {user?.avatarUrl && !avatarLoadError ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatarImage}
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.name || 'Mahasiswa Magang'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email || '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Kartu Status Google Drive */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Koneksi Google Drive</Text>
            <View style={[styles.statusBadge, badgeContainerStyle]}>
              <Text style={[styles.statusBadgeText, badgeTextStyle]}>
                {driveInfo.badgeLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.cardBodyText}>{driveInfo.description}</Text>
          <Text style={styles.storageNote}>
            DayDone menyimpan seluruh foto dokumentasi secara privat di folder{' '}
            <Text style={styles.boldText}>Google Drive/DayDone</Text> milik akun Anda sendiri.
          </Text>

          {driveSuccess && (
            <View style={styles.successBox} accessibilityRole="alert">
              <Text style={styles.successText}>{driveSuccess}</Text>
            </View>
          )}

          {driveError && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{driveError}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.driveActionButton,
              driveInfo.tone === 'warning' && styles.driveActionWarning,
              pressed && !isReconnecting && styles.pressed,
              isReconnecting && styles.disabled,
            ]}
            onPress={() => void handleReconnectDrivePress()}
            disabled={isReconnecting}
            accessibilityRole="button"
            accessibilityLabel="Hubungkan Ulang Google Drive">
            {isReconnecting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.driveActionText}>Menghubungkan...</Text>
              </View>
            ) : (
              <Text style={styles.driveActionText}>
                Hubungkan Ulang Google Drive
              </Text>
            )}
          </Pressable>
        </View>

        {/* Kartu Sesi & Keluar */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sesi Perangkat</Text>
          <Text style={styles.cardBodyText}>
            Keluar akan mencabut sesi perangkat ini dan membersihkan cache lokal agar aman saat berganti akun.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && !isLoggingOut && styles.pressed,
              isLoggingOut && styles.disabled,
            ]}
            onPress={handleLogoutPress}
            disabled={isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="Keluar dari akun">
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#B91C1C" />
            ) : (
              <Text style={styles.logoutButtonText}>Keluar</Text>
            )}
          </Pressable>
        </View>

        {/* Danger Zone — Hapus Akun Permanen */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Zona Berbahaya (Danger Zone)</Text>
          <Text style={styles.dangerDescription}>
            Menghapus akun akan menghapus permanen seluruh catatan logbook, data lampiran, dan sesi Anda di server DayDone. Tindakan ini tidak dapat dibatalkan.
          </Text>
          <Text style={styles.dangerDriveNote}>
            File foto asli yang tersimpan di folder{' '}
            <Text style={styles.boldText}>Google Drive/DayDone</Text> Anda tetap aman dan tidak ikut dihapus.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.dangerButton,
              pressed && styles.pressed,
            ]}
            onPress={handleOpenDeleteModal}
            accessibilityRole="button"
            accessibilityLabel="Hapus akun permanen">
            <Text style={styles.dangerButtonText}>Hapus Akun Permanen</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal Konfirmasi Ketat Ketik "HAPUS" */}
      <Modal
        visible={isDeleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDeleteModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Konfirmasi Hapus Akun</Text>
            <Text style={styles.modalMessage}>
              Seluruh data logbook dan sesi Anda di DayDone akan dihapus permanen. File foto di Google Drive tetap aman.
            </Text>
            <Text style={styles.modalPrompt}>
              Ketik <Text style={styles.modalKeyword}>HAPUS</Text> (huruf kapital persis) untuk mengonfirmasi:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={confirmInput}
              onChangeText={(text) => {
                setConfirmInput(text);
                if (deleteError) setDeleteError(null);
              }}
              placeholder="Ketik HAPUS"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleteAccount.isPending}
              accessibilityLabel="Konfirmasi ketik HAPUS"
            />

            {deleteError && (
              <Text style={styles.modalErrorText} accessibilityRole="alert">
                {deleteError}
              </Text>
            )}

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  deleteAccount.isPending && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleCloseDeleteModal}
                disabled={deleteAccount.isPending}
                accessibilityRole="button"
                accessibilityLabel="Batalkan hapus akun">
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  !canConfirmDelete && styles.disabled,
                  pressed && canConfirmDelete && styles.pressed,
                ]}
                onPress={() => void handleExecuteDeleteAccount()}
                disabled={!canConfirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Konfirmasi hapus akun permanen">
                {deleteAccount.isPending ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.modalConfirmText}>Menghapus...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalConfirmText}>Hapus Akun</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 18,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E2E8F0',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0369A1',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeConnected: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextConnected: {
    color: '#15803D',
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextWarning: {
    color: '#B45309',
  },
  badgeNeutral: {
    backgroundColor: '#E2E8F0',
  },
  badgeTextNeutral: {
    color: '#334155',
  },
  cardBodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 10,
  },
  storageNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  boldText: {
    fontWeight: '700',
    color: '#1E293B',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    lineHeight: 17,
  },
  driveActionButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  driveActionWarning: {
    backgroundColor: '#D97706',
  },
  driveActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    marginBottom: 8,
  },
  dangerDriveNote: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
    marginBottom: 14,
  },
  dangerButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#991B1B',
  },
  modalMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  modalPrompt: {
    fontSize: 13,
    color: '#0F172A',
    marginTop: 4,
  },
  modalKeyword: {
    fontWeight: '800',
    color: '#DC2626',
  },
  modalInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  modalConfirmButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
