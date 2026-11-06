import type { Attachment } from '@daydone/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ImageOff, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDeleteAttachment } from '../../api/attachments.js';
import { ConfirmModal } from '../common/confirm-modal.js';
import { PhotoLightbox } from './photo-lightbox.js';

export interface PhotoGalleryProps {
  attachments: Attachment[];
  logId: string;
  className?: string;
}

export function PhotoGallery({
  attachments,
  logId,
  className = '',
}: PhotoGalleryProps) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteAttachment(logId);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Delete modal state
  const [deletingAttachment, setDeletingAttachment] = useState<Attachment | null>(null);

  // Catat ID lampiran yang sudah pernah mencoba refetch sekali saat onError untuk cegah infinite loop
  const refetchedIdsRef = useRef<Set<string>>(new Set());

  // Set gambar yang gagal dimuat bahkan setelah refetch untuk menampilkan fallback UI
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleImageError = (attachmentId: string) => {
    if (!refetchedIdsRef.current.has(attachmentId)) {
      refetchedIdsRef.current.add(attachmentId);
      // Refetch detail query untuk memperbarui signed URL yang kedaluwarsa (5 menit)
      queryClient.invalidateQueries({ queryKey: ['logs', 'detail', logId] });
    } else {
      // Jika masih error setelah refetch, tampilkan fallback ikon
      setFailedImageIds((prev) => new Set(prev).add(attachmentId));
    }
  };

  const handleOpenLightbox = (index: number) => {
    setSelectedPhotoIndex(index);
    setLightboxOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAttachment) return;
    try {
      await deleteMutation.mutateAsync(deletingAttachment.id);
    } finally {
      setDeletingAttachment(null);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">
          Foto Dokumentasi ({attachments.length}/5)
        </h4>
        <span className="text-xs text-slate-500">Klik foto untuk melihat layar penuh</span>
      </div>

      {/* Grid Thumbnail Foto */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {attachments.map((att, index) => {
          const isFailed = failedImageIds.has(att.id);

          return (
            <div
              key={att.id}
              className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xs transition hover:shadow-md"
            >
              {isFailed ? (
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-slate-400">
                  <ImageOff className="h-6 w-6 mb-1" />
                  <span className="text-[11px] text-center">Gambar tidak dapat dimuat</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenLightbox(index)}
                  className="h-full w-full cursor-pointer focus:outline-hidden"
                  aria-label={`Buka foto ${index + 1}: ${att.fileName}`}
                >
                  <img
                    src={att.url || ''}
                    alt={att.fileName}
                    referrerPolicy="no-referrer"
                    onError={() => handleImageError(att.id)}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </button>
              )}

              {/* Tombol Hapus Foto */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingAttachment(att);
                }}
                disabled={deleteMutation.isPending}
                aria-label={`Hapus foto ${att.fileName}`}
                className="absolute top-2 right-2 rounded-xl bg-slate-900/60 p-2 text-white backdrop-blur-xs transition hover:bg-rose-600 focus:outline-hidden focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
              >
                {deleteMutation.isPending && deletingAttachment?.id === att.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      <PhotoLightbox
        attachments={attachments}
        currentIndex={selectedPhotoIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setSelectedPhotoIndex(newIdx)}
      />

      {/* Modal Konfirmasi Hapus Foto */}
      <ConfirmModal
        isOpen={Boolean(deletingAttachment)}
        title="Hapus Foto Dokumentasi?"
        message="Foto ini akan dihapus dari catatan logbook dan dipindahkan ke Tempat Sampah Google Drive Anda."
        confirmText="Hapus Foto"
        cancelText="Batal"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAttachment(null)}
      />
    </div>
  );
}
