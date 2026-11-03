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

/**
 * Memetakan entitas Prisma LogEntry ke format objek Log detail di API spec.
 * - Mengonversi tanggal ke format string "YYYY-MM-DD"
 * - Mengonversi timestamp ke ISO 8601 UTC string
 * - Menghapus field sensitif/internal (userId)
 */
export function toLogResponse(log: LogEntityLike): LogResponse {
  return {
    id: log.id,
    date: fromDbDate(log.date),
    description: log.description,
    attachments: (log.attachments ?? []).map((att) => ({
      id: att.id,
      fileName: att.fileName,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      width: att.width,
      height: att.height,
      position: att.position,
      url: null,
      urlExpiresAt: null,
    })),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

/**
 * Memetakan entitas Prisma LogEntry ke format daftar Log (disertai attachmentCount).
 */
export function toLogListItemResponse(log: LogEntityLike): LogListItemResponse {
  const base = toLogResponse(log);
  const attachmentCount =
    log._count?.attachments ?? log.attachments?.length ?? 0;

  return {
    ...base,
    attachmentCount,
  };
}
