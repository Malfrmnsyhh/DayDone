import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { SelectedImageFile } from './attachments-api';

function showPermissionDeniedAlert(
  title: string,
  message: string,
  canAskAgain: boolean,
): void {
  if (!canAskAgain) {
    Alert.alert(title, `${message} Aktifkan izin melalui Pengaturan perangkat.`, [
      { text: 'Tutup', style: 'cancel' },
      {
        text: 'Buka Pengaturan',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]);
    return;
  }

  Alert.alert(title, message);
}

function mapAssetToSelectedFile(
  asset: ImagePicker.ImagePickerAsset,
): SelectedImageFile {
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    fileSize: asset.fileSize ?? null,
  };
}

/**
 * Meminta izin kamera lalu membuka kamera native untuk mengambil 1 foto dokumentasi.
 * Mengembalikan null bila pengguna membatalkan atau izin ditolak.
 */
export async function pickImageFromCamera(): Promise<SelectedImageFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    showPermissionDeniedAlert(
      'Izin Kamera Diperlukan',
      'DayDone membutuhkan akses kamera untuk memotret kegiatan magang Anda.',
      permission.canAskAgain,
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return mapAssetToSelectedFile(result.assets[0]);
}

/**
 * Meminta izin galeri lalu membuka pemilih foto native (multi-select dibatasi sisa kuota).
 * Mengembalikan array kosong bila pengguna membatalkan atau izin ditolak.
 */
export async function pickImagesFromGallery(
  selectionLimit: number,
): Promise<SelectedImageFile[]> {
  if (selectionLimit <= 0) {
    return [];
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showPermissionDeniedAlert(
      'Izin Galeri Diperlukan',
      'DayDone membutuhkan akses galeri untuk memilih foto dokumentasi kegiatan magang Anda.',
      permission.canAskAgain,
    );
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: selectionLimit > 1,
    selectionLimit,
    quality: 0.9,
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return [];
  }

  return result.assets.map(mapAssetToSelectedFile);
}
