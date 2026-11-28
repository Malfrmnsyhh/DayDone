import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove } from 'expo-router';
import type { CreateLogDto } from '@daydone/shared';
import { MAX_DESCRIPTION_LENGTH } from '@daydone/shared';
import {
  formatDateIndonesian,
  getTodayLocalDateString,
  isValidDateString,
  shiftLocalDateString,
} from '@/lib/date';
import {
  type LogDateConflictInfo,
  type LogFormValidationErrors,
  validateLogFormInput,
} from '@/lib/logs-api';

export interface LogFormProps {
  mode: 'create' | 'edit';
  initialDate: string;
  initialDescription?: string;
  isSubmitting: boolean;
  conflictError: LogDateConflictInfo | null;
  submitError: string | null;
  onClearServerError: () => void;
  onSubmit: (data: CreateLogDto) => Promise<boolean>;
  onOpenConflictLog: (existingLogId: string) => void;
}

export function LogForm({
  mode,
  initialDate,
  initialDescription = '',
  isSubmitting,
  conflictError,
  submitError,
  onClearServerError,
  onSubmit,
  onOpenConflictLog,
}: LogFormProps) {
  const today = getTodayLocalDateString();
  const yesterday = shiftLocalDateString(today, -1);

  const [date, setDate] = useState(initialDate);
  const [description, setDescription] = useState(initialDescription);
  const [fieldErrors, setFieldErrors] = useState<LogFormValidationErrors>({});
  const [isGuardBypassed, setIsGuardBypassed] = useState(false);

  const isDirty = date !== initialDate || description !== initialDescription;
  const isDateValid = isValidDateString(date);
  const canStepForward = isDateValid && date < today;
  const canStepBackward = isDateValid;

  // Proteksi unsaved changes saat user menekan Back atau keluar dari layar
  const disablePrevention = usePreventRemove(
    isDirty && !isGuardBypassed,
    ({ repeat }) => {
      Alert.alert(
        'Buang perubahan?',
        'Perubahan yang kamu ketik pada logbook belum disimpan. Yakin ingin meninggalkan halaman ini?',
        [
          { text: 'Lanjut Menulis', style: 'cancel' },
          {
            text: 'Tinggalkan',
            style: 'destructive',
            onPress: () => {
              setIsGuardBypassed(true);
              repeat();
            },
          },
        ],
      );
    },
  );

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    if (fieldErrors.date) {
      setFieldErrors((prev) => ({ ...prev, date: undefined }));
    }
    if (conflictError || submitError) {
      onClearServerError();
    }
  };

  const handleDescriptionChange = (nextDesc: string) => {
    setDescription(nextDesc);
    if (fieldErrors.description) {
      setFieldErrors((prev) => ({ ...prev, description: undefined }));
    }
    if (submitError) {
      onClearServerError();
    }
  };

  const handleStepDate = (deltaDays: number) => {
    if (!isDateValid) {
      handleDateChange(today);
      return;
    }

    const nextDate = shiftLocalDateString(date, deltaDays);
    if (nextDate > today) {
      return;
    }
    handleDateChange(nextDate);
  };

  const handleOpenConflict = (existingLogId: string) => {
    setIsGuardBypassed(true);
    disablePrevention();
    onOpenConflictLog(existingLogId);
  };

  const handlePressSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const validation = validateLogFormInput({ date, description }, today);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsGuardBypassed(true);
    disablePrevention();
    const succeeded = await onSubmit(validation.data);
    if (!succeeded) {
      setIsGuardBypassed(false);
    }
  };

  const charCount = description.length;
  const isOverLimit = charCount > MAX_DESCRIPTION_LENGTH;
  const isNearLimit =
    !isOverLimit && charCount >= MAX_DESCRIPTION_LENGTH - 500;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          {/* Callout Konflik 409 LOG_DATE_CONFLICT */}
          {conflictError && (
            <View style={styles.alertBox} accessibilityRole="alert">
              <Text style={styles.alertTitle}>Tanggal Sudah Memiliki Logbook</Text>
              <Text style={styles.alertMessage}>{conflictError.message}</Text>
              {conflictError.existingLogId && (
                <Pressable
                  style={({ pressed }) => [
                    styles.conflictActionButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    handleOpenConflict(conflictError.existingLogId as string)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Buka logbook tanggal itu">
                  <Text style={styles.conflictActionText}>
                    Buka logbook tanggal itu →
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Callout Error Umum */}
          {!conflictError && submitError && (
            <View style={styles.alertBox} accessibilityRole="alert">
              <Text style={styles.alertTitle}>Gagal Menyimpan</Text>
              <Text style={styles.alertMessage}>{submitError}</Text>
            </View>
          )}

          {/* Bagian Tanggal Logbook (Pure-JS, tidak di-disable pada mode ubah) */}
          <View style={styles.card}>
            <Text style={styles.label}>Tanggal Logbook</Text>
            <Text style={styles.datePreview}>
              {isDateValid
                ? formatDateIndonesian(date)
                : 'Format tanggal belum valid (YYYY-MM-DD)'}
            </Text>

            {/* Tombol Pintasan Cepat: Hari Ini & Kemarin */}
            <View style={styles.shortcutRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.shortcutButton,
                  date === today && styles.shortcutButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleDateChange(today)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Pilih tanggal hari ini">
                <Text
                  style={[
                    styles.shortcutText,
                    date === today && styles.shortcutTextActive,
                  ]}>
                  Hari Ini
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.shortcutButton,
                  date === yesterday && styles.shortcutButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleDateChange(yesterday)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Pilih tanggal kemarin">
                <Text
                  style={[
                    styles.shortcutText,
                    date === yesterday && styles.shortcutTextActive,
                  ]}>
                  Kemarin
                </Text>
              </Pressable>
            </View>

            {/* Stepper Harian + Input YYYY-MM-DD */}
            <View style={styles.stepperRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.stepperButton,
                  (!canStepBackward || isSubmitting) && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleStepDate(-1)}
                disabled={!canStepBackward || isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Mundur 1 hari">
                <Text style={styles.stepperButtonText}>←</Text>
              </Pressable>

              <TextInput
                style={[
                  styles.dateInput,
                  fieldErrors.date && styles.inputError,
                ]}
                value={date}
                onChangeText={handleDateChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
                editable={!isSubmitting}
                accessibilityLabel="Input tanggal format YYYY-MM-DD"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.stepperButton,
                  (!canStepForward || isSubmitting) && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleStepDate(1)}
                disabled={!canStepForward || isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Maju 1 hari">
                <Text style={styles.stepperButtonText}>→</Text>
              </Pressable>
            </View>

            {fieldErrors.date ? (
              <Text style={styles.fieldError}>{fieldErrors.date}</Text>
            ) : (
              <Text style={styles.helperText}>
                Maksimal hari ini ({today}) menurut zona waktu perangkat.
              </Text>
            )}
          </View>

          {/* Bagian Deskripsi Kegiatan */}
          <View style={styles.card}>
            <View style={styles.descHeader}>
              <Text style={styles.label}>Deskripsi Kegiatan Magang</Text>
              <Text
                style={[
                  styles.counterText,
                  isNearLimit && styles.counterNearLimit,
                  isOverLimit && styles.counterOverLimit,
                ]}>
                {charCount} / {MAX_DESCRIPTION_LENGTH}
              </Text>
            </View>

            <TextInput
              style={[
                styles.descriptionInput,
                fieldErrors.description && styles.inputError,
              ]}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Catat aktivitas, fitur yang dikerjakan, kendala, atau hal baru yang kamu pelajari hari ini..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              editable={!isSubmitting}
              accessibilityLabel="Deskripsi kegiatan magang"
            />

            {fieldErrors.description && (
              <Text style={styles.fieldError}>{fieldErrors.description}</Text>
            )}
          </View>

          {/* Tombol Simpan */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && !isSubmitting && styles.pressed,
              isSubmitting && styles.disabled,
            ]}
            onPress={() => void handlePressSubmit()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'edit' ? 'Simpan perubahan logbook' : 'Simpan logbook'
            }>
            {isSubmitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Menyimpan...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Logbook'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  alertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  alertMessage: {
    fontSize: 13,
    color: '#B91C1C',
    lineHeight: 19,
  },
  conflictActionButton: {
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  conflictActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  datePreview: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 12,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  shortcutButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutButtonActive: {
    borderColor: '#0284C7',
    backgroundColor: '#E0F2FE',
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  shortcutTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 48,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  descHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  counterNearLimit: {
    color: '#D97706',
  },
  counterOverLimit: {
    color: '#DC2626',
  },
  descriptionInput: {
    minHeight: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 22,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 8,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
    opacity: 0.5,
  },
});
