import type { Attachment } from '@daydone/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface PhotoLightboxProps {
  attachments: Attachment[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
}

export function PhotoLightbox({
  attachments,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const validAttachments = attachments.filter((a) => Boolean(a.url));
  const total = validAttachments.length;
  const current = validAttachments[currentIndex] || validAttachments[0];

  useEffect(() => {
    if (!isOpen) return;

    // Kunci scroll halaman saat lightbox aktif
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Fokus ke modal untuk aksesibilitas keyboard
    modalRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !current || total === 0) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowLeft') {
      e.stopPropagation();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.stopPropagation();
      handleNext();
    }
  };

  const handlePrev = () => {
    const nextIdx = (currentIndex - 1 + total) % total;
    onNavigate(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % total;
    onNavigate(nextIdx);
  };

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Penampil foto layar penuh"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 p-4 text-white backdrop-blur-xs select-none focus:outline-hidden"
    >
      {/* Header Lightbox: Nomor urut foto & tombol tutup */}
      <div className="flex w-full items-center justify-between px-2 py-3 sm:px-6">
        <span className="text-xs sm:text-sm font-medium text-slate-300">
          Foto {currentIndex + 1} dari {total}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup penampil foto"
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-hidden focus:ring-2 focus:ring-white transition"
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </div>

      {/* Konten Gambar Tengah */}
      <div className="relative flex flex-1 w-full items-center justify-center overflow-hidden px-2 sm:px-12">
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Foto sebelumnya"
            className="absolute left-2 sm:left-4 z-10 rounded-full bg-black/50 p-2 sm:p-3 text-white backdrop-blur-md hover:bg-black/80 focus:outline-hidden focus:ring-2 focus:ring-white transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <img
          key={current.id}
          src={current.url || ''}
          alt={current.fileName}
          referrerPolicy="no-referrer"
          className="max-h-[80vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-lg shadow-2xl transition-transform duration-200"
        />

        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Foto berikutnya"
            className="absolute right-2 sm:right-4 z-10 rounded-full bg-black/50 p-2 sm:p-3 text-white backdrop-blur-md hover:bg-black/80 focus:outline-hidden focus:ring-2 focus:ring-white transition"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Footer Lightbox: Nama file */}
      <div className="w-full text-center py-3 text-xs sm:text-sm text-slate-400 truncate px-4">
        {current.fileName}
      </div>
    </div>
  );
}
