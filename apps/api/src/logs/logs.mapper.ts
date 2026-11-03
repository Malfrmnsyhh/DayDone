import { fromDbDate } from '../common/date.js';

export interface AttachmentResponse {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  position: number;
  url: string | null;
  urlExpiresAt?: string | null;
}

export interface LogResponse {
  id: string;
  date: string;
  description: string;
  attachments: AttachmentResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface LogListItemResponse extends LogResponse {
  attachmentCount: number;
}

export interface PaginatedLogsResponse {
  data: LogListItemResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LogEntityLike {
  id: string;
  userId?: string;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    position: number;
  }>;
  _count?: {
    attachments?: number;
  };
}

export type UrlBuilder = (
  attachmentId: string,
) => { url: string; urlExpiresAt: string } | null;

/**
 * Memetakan entitas Prisma LogEntry ke format objek Log detail di API spec.
 * - Mengonversi tanggal ke format string "YYYY-MM-DD"
 * - Mengonversi timestamp ke ISO 8601 UTC string
 * - Menghapus field sensitif/internal (userId)
 * - Menyertakan url dan urlExpiresAt bertanda tangan via buildUrl bila tersedia
 */
export function toLogResponse(
  log: LogEntityLike,
  buildUrl?: UrlBuilder,
): LogResponse {
  return {
    id: log.id,
    date: fromDbDate(log.date),
    description: log.description,
    attachments: (log.attachments ?? []).map((att) => {
      const urlInfo = buildUrl ? buildUrl(att.id) : null;
      return {
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        width: att.width,
        height: att.height,
        position: att.position,
        url: urlInfo?.url ?? null,
        urlExpiresAt: urlInfo?.urlExpiresAt ?? null,
      };
    }),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

/**
 * Memetakan entitas Prisma LogEntry ke format daftar Log (disertai attachmentCount).
 * Hanya lampiran pertama (thumbnail) yang menyertakan url dan urlExpiresAt, sisanya null.
 */
export function toLogListItemResponse(
  log: LogEntityLike,
  buildUrl?: UrlBuilder,
): LogListItemResponse {
  const attachmentCount =
    log._count?.attachments ?? log.attachments?.length ?? 0;

  return {
    id: log.id,
    date: fromDbDate(log.date),
    description: log.description,
    attachments: (log.attachments ?? []).map((att, index) => {
      const urlInfo = index === 0 && buildUrl ? buildUrl(att.id) : null;
      return {
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        width: att.width,
        height: att.height,
        position: att.position,
        url: urlInfo?.url ?? null,
        urlExpiresAt: urlInfo?.urlExpiresAt ?? null,
      };
    }),
    attachmentCount,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}
