import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth-store';
import { getDriveStatusInfo, shouldShowDriveBanner } from '@/lib/drive-status';

export interface DriveReconnectBannerProps {
  /** Dipanggil opsional setelah rekoneksi berhasil (mis. menampilkan feedback ringan). */
  onReconnected?: () => void;
}

/**
 * Banner peringatan status Google Drive untuk layar Beranda dan Detail Logbook.
 * Otomatis tersembunyi bila user tidak ada atau `driveStatus === 'CONNECTED'`.
 */
export function DriveReconnectBanner({
  onReconnected,
}: DriveReconnectBannerProps) {
  const { user, reconnectGoogleDrive } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!user || !shouldShowDriveBanner(user.driveStatus)) {
    return null;
  }

  const driveInfo = getDriveStatusInfo(user.driveStatus);
  const isWarning = driveInfo.tone === 'warning';

  const handleReconnectPress = async () => {
    if (isConnecting) return;
    setErrorMessage(null);
    setIsConnecting(true);

    try {
      const outcome = await reconnectGoogleDrive();
      if (outcome === 'connected' && onReconnected) {
        onReconnected();
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menghubungkan Google Drive. Silakan coba lagi.';
      setErrorMessage(message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View
      style={[styles.container, isWarning ? styles.warningBox : styles.infoBox]}
      accessibilityRole="alert">
      <Text
        style={[
          styles.title,
          isWarning ? styles.warningTitle : styles.infoTitle,
        ]}>
        {driveInfo.title}
      </Text>
      <Text
        style={[
          styles.description,
          isWarning ? styles.warningDesc : styles.infoDesc,
        ]}>
        {driveInfo.description}
      </Text>

      {errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          isWarning ? styles.warningButton : styles.infoButton,
          pressed && !isConnecting && styles.pressed,
          isConnecting && styles.disabled,
        ]}
        onPress={() => void handleReconnectPress()}
        disabled={isConnecting}
        accessibilityRole="button"
        accessibilityLabel={driveInfo.actionLabel}>
        {isConnecting ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Menghubungkan...</Text>
          </View>
        ) : (
          <Text style={styles.actionButtonText}>{driveInfo.actionLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 14,
  },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderLeftColor: '#D97706',
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderLeftColor: '#0284C7',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningTitle: {
    color: '#B45309',
  },
  infoTitle: {
    color: '#0369A1',
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  warningDesc: {
    color: '#92400E',
  },
  infoDesc: {
    color: '#0C4A6E',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    lineHeight: 17,
    marginBottom: 10,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningButton: {
    backgroundColor: '#D97706',
  },
  infoButton: {
    backgroundColor: '#0284C7',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    opacity: 0.65,
  },
});
