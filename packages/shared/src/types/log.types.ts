import type { Attachment } from './attachment.types.js';

export interface Log {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  attachments: Attachment[];
  attachmentCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface LogListItem {
  id: string;
  date: string; // YYYY-MM-DD
  descriptionSnippet: string;
  attachmentCount: number;
  firstAttachmentThumbnailUrl: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

