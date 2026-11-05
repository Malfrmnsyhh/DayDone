import { zodResolver } from '../lib/zod-resolver.js';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useBlocker } from 'react-router-dom';
import { createLogSchema, type CreateLogDto } from '@daydone/shared';
import { ApiError } from '../api/api-error.js';
import { useCreateLog, useLogDetail, useUpdateLog } from '../api/logs.js';
import { ConfirmModal } from '../components/common/confirm-modal.js';
import { DetailSkeleton } from '../components/common/loading-skeleton.js';
import { NotFoundState } from '../components/common/not-found-state.js';
import { getTodayLocalDateString } from '../lib/date.js';

export function LogFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const today = getTodayLocalDateString();

  const [conflictLogId, setConflictLogId] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmittingSuccess, setIsSubmittingSuccess] = useState(false);

  // Detail query untuk mode edit
  const {
    data: detailLog,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useLogDetail(id);

  const createMutation = useCreateLog();
  const updateMutation = useUpdateLog(id || '');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateLogDto>({
    resolver: zodResolver(createLogSchema) as any,
    defaultValues: {
      date: today,
      description: '',
    },
  });

  const descriptionValue = watch('description') || '';

  // Isi data form saat mode edit selesai memuat detail logbook
  useEffect(() => {
    if (isEdit && detailLog) {
      reset({
        date: detailLog.date,
        description: detailLog.description,
      });
    }
  }, [isEdit, detailLog, reset]);

  // Cegah navigasi jika ada perubahan belum tersimpan (React Router Blocker)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !isSubmittingSuccess &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  // Cegah penutupan tab atau reload browser jika form kotor
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmittingSuccess) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSubmittingSuccess]);

  if (isEdit && isDetailLoading) {
    return <DetailSkeleton />;
  }

  if (isEdit && (isDetailError || !detailLog)) {
    return <NotFoundState />;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateLogDto) => {
    setConflictLogId(null);
    setGeneralError(null);

    try {
      if (isEdit) {
        const res = await updateMutation.mutateAsync({
          date: values.date,
          description: values.description,
        });
        setIsSubmittingSuccess(true);
        navigate(`/logs/${res.id}`);
      } else {
        const res = await createMutation.mutateAsync({
          date: values.date,
          description: values.description,
        });
        setIsSubmittingSuccess(true);
        navigate(`/logs/${res.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'LOG_DATE_CONFLICT') {
          setConflictLogId(err.existingLogId || null);
          setGeneralError(err.message);
          return;
        }
        setGeneralError(err.message);
      } else {
        setGeneralError('Gagal menyimpan logbook. Pastikan koneksi atau server aktif.');
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header bar navigasi */}
      <div className="flex items-center justify-between">
        <Link
          to={isEdit ? `/logs/${id}` : '/'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isEdit ? 'Kembali ke Detail' : 'Kembali ke Dashboard'}</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {isEdit ? 'Ubah Catatan Logbook' : 'Tulis Logbook Baru'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {isEdit
              ? 'Perbarui tanggal atau deskripsi catatan magang Anda.'
              : 'Catat kegiatan magang yang Anda lakukan beserta ringkasan pembelajarannya.'}
          </p>
        </div>

        <hr className="my-6 border-slate-100" />

        {/* Alert Error Konflik Tanggal atau Umum */}
        {generalError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900"
          >
            <p className="font-semibold">{generalError}</p>
            {conflictLogId && (
              <div className="mt-2.5">
                <Link
                  to={`/logs/${conflictLogId}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 font-bold text-red-800 hover:bg-red-200 transition"
                >
                  <span>Buka logbook tanggal itu</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Input Tanggal */}
          <div>
            <label
              htmlFor="date-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Tanggal Logbook
            </label>
            <div className="relative max-w-xs">
              <input
                id="date-input"
                type="date"
                max={today}
                {...register('date')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
            {errors.date && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                {errors.date.message}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              Maksimal tanggal hari ini menurut zona waktu perangkat Anda.
            </p>
          </div>

          {/* Input Deskripsi */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="desc-input"
                className="block text-xs font-bold text-slate-700"
              >
                Deskripsi Kegiatan Magang
              </label>
              <span
                className={`text-[11px] font-semibold ${
                  descriptionValue.length > 5000
                    ? 'text-red-600'
                    : descriptionValue.length >= 4500
                      ? 'text-amber-600'
                      : 'text-slate-400'
                }`}
              >
                {descriptionValue.length} / 5000 karakter
              </span>
            </div>

            <textarea
              id="desc-input"
              rows={8}
              placeholder="Jelaskan aktivitas, fitur yang dikerjakan, kendala yang dihadapi, atau wawasan baru yang Anda pelajari hari ini..."
              {...register('description')}
              className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition leading-relaxed"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Link
              to={isEdit ? `/logs/${id}` : '/'}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="h-4 w-4" />
              <span>
                {isPending
                  ? 'Menyimpan...'
                  : isEdit
                    ? 'Simpan Perubahan'
                    : 'Simpan Logbook'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal Dialog Konfirmasi Tinggalkan Halaman */}
      <ConfirmModal
        isOpen={blocker.state === 'blocked'}
        title="Tinggalkan Halaman?"
        message="Perubahan yang Anda ketik pada logbook belum disimpan. Yakin ingin meninggalkan halaman ini?"
        confirmText="Ya, Tinggalkan"
        cancelText="Lanjut Menulis"
        variant="warning"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}
