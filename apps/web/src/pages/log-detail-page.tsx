import {
  ArrowLeft,
  Calendar,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteLog, useLogDetail } from '../api/logs.js';
import { useAuth } from '../auth/auth-context.js';
import { PhotoGallery } from '../components/attachments/photo-gallery.js';
import { PhotoUploadDropzone } from '../components/attachments/photo-upload-dropzone.js';
import { ConfirmModal } from '../components/common/confirm-modal.js';
import { ErrorState } from '../components/common/error-state.js';
import { DetailSkeleton } from '../components/common/loading-skeleton.js';
import { NotFoundState } from '../components/common/not-found-state.js';
import { DriveBanner } from '../components/drive/drive-banner.js';
import { formatDateIndonesian } from '../lib/date.js';

export function LogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: log, isLoading, isError, error, refetch } = useLogDetail(id);
  const deleteMutation = useDeleteLog();

  if (isLoading) {
    return <DetailSkeleton />;
  }

  // Cek apakah error merupakan 404 Not Found
  const is404 =
    (error as any)?.statusCode === 404 ||
    (error as any)?.status === 404;

  if (isError || !log) {
    if (is404) {
      return (
        <NotFoundState
          title="Logbook Tidak Ditemukan"
          message="Logbook ini mungkin telah dihapus atau Anda tidak memiliki izin untuk melihatnya."
        />
      );
    }

    return (
      <ErrorState
        title="Gagal Memuat Detail Logbook"
        message="Terjadi kendala saat mengambil rincian logbook dari server."
        onRetry={() => refetch()}
      />
    );
  }

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      setIsDeleteOpen(false);
      navigate('/');
    } catch {
      // Error ditangani oleh mutation state
    }
  };

  const attachments = log.attachments || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Banner Peringatan Google Drive bila belum terhubung / terputus */}
      <DriveBanner />

      {/* Bar Navigasi Kembali */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header Logbook */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <Calendar className="h-4 w-4" />
              <span>Tanggal Pelaksanaan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {formatDateIndonesian(log.date)}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/logs/${log.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Ubah</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 shadow-2xs hover:bg-red-50 hover:border-red-300 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus</span>
            </button>
          </div>
        </div>

        {/* Deskripsi Kegiatan (Plain Text dengan whitespace-pre-wrap, TANPA dangerouslySetInnerHTML) */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Catatan Aktivitas Magang
          </h2>
          <div className="rounded-xl bg-slate-50/70 p-4 sm:p-5 border border-slate-100">
            <p className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed break-words">
              {log.description}
            </p>
          </div>
        </div>

        {/* Galeri Foto Dokumentasi */}
        {attachments.length > 0 && (
          <div className="pt-2">
            <PhotoGallery
              attachments={attachments}
              logId={log.id}
            />
          </div>
        )}

        {/* Area Unggah Foto Dropzone */}
        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            {attachments.length > 0 ? 'Tambah Foto Dokumentasi' : 'Foto Dokumentasi'}
          </h3>
          <PhotoUploadDropzone
            logId={log.id}
            currentAttachmentCount={attachments.length}
            driveStatus={user?.driveStatus}
          />
        </div>
      </div>

      {/* Modal Dialog Konfirmasi Hapus Logbook */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        title="Hapus Logbook?"
        message={`Apakah Anda yakin ingin menghapus catatan logbook tanggal ${formatDateIndonesian(
          log.date,
        )}? Tindakan ini akan menghapus logbook dan seluruh file foto terkait dari sistem.`}
        confirmText="Ya, Hapus Logbook"
        cancelText="Batal"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
