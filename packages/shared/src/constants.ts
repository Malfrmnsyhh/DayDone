/**
 * Konstanta bersama untuk DayDone (API, Web, Mobile).
 */

export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MIN_DESCRIPTION_LENGTH = 1;
export const MAX_DESCRIPTION_LENGTH = 5000;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const CSRF_HEADER_NAME = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'daydone-web';
export const REFRESH_COOKIE_NAME = 'daydone_rt';

export const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 menit

