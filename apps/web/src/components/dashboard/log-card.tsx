import type { LogListItem } from '@daydone/shared';
import { ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateIndonesian } from '../../lib/date.js';

interface LogCardProps {
  log: LogListItem;
}

export function LogCard({ log }: LogCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      to={`/logs/${log.id}`}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition"
    >
      <div className="flex items-start gap-4 flex-1 min-w-0">
        {/* Thumbnail atau Placeholder Foto Pertama */}
        {log.attachmentCount > 0 && (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
            {log.firstAttachmentThumbnailUrl && !imgFailed ? (
              <img
                src={log.firstAttachmentThumbnailUrl}
                alt="Thumbnail lampiran"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            {log.attachmentCount > 1 && (
              <span className="absolute bottom-1 right-1 rounded-md bg-slate-900/75 px-1 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                +{log.attachmentCount - 1}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              {formatDateIndonesian(log.date)}
            </span>
            {log.attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                <ImageIcon className="h-3 w-3" />
                <span>{log.attachmentCount}</span>
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {log.descriptionSnippet}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
        <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1 transition">
          <span>Detail</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
        </span>
      </div>
    </Link>
  );
}
