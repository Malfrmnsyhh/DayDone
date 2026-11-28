import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CreateLogDto } from '@daydone/shared';
import { LogForm } from '@/components/log-form';
import { getTodayLocalDateString } from '@/lib/date';
import {
  getLogDateConflict,
  type LogDateConflictInfo,
  resolveInitialFormDate,
  useCreateLog,
} from '@/lib/logs-api';

export default function NewLogScreen() {
  const { date: requestedDate } = useLocalSearchParams<{
    date?: string | string[];
  }>();
  const router = useRouter();
  const createLog = useCreateLog();

  const initialDate = resolveInitialFormDate(
    requestedDate,
    getTodayLocalDateString(),
  );

  const [conflictError, setConflictError] =
    useState<LogDateConflictInfo | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleClearServerError = () => {
    setConflictError(null);
    setSubmitError(null);
  };

  const handleSubmit = async (data: CreateLogDto): Promise<boolean> => {
    handleClearServerError();

    try {
      const created = await createLog.mutateAsync(data);
      router.replace({ pathname: '/logs/[id]', params: { id: created.id } });
      return true;
    } catch (error: unknown) {
      const conflict = getLogDateConflict(error);
      if (conflict) {
        setConflictError(conflict);
        return false;
      }

      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan logbook. Pastikan koneksi ke server aktif.',
      );
      return false;
    }
  };

  const handleOpenConflictLog = (existingLogId: string) => {
    router.replace({ pathname: '/logs/[id]', params: { id: existingLogId } });
  };

  return (
    <LogForm
      mode="create"
      initialDate={initialDate}
      isSubmitting={createLog.isPending}
      conflictError={conflictError}
      submitError={submitError}
      onClearServerError={handleClearServerError}
      onSubmit={handleSubmit}
      onOpenConflictLog={handleOpenConflictLog}
    />
  );
}
