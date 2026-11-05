export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  url: string;
  urlExpiresAt: string;
}

