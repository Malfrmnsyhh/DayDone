export interface AttachmentResponse {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  url: string | null;
  urlExpiresAt: string | null;
  createdAt: string;
}

export interface AttachmentUrlResponse {
  url: string;
  expiresAt: string;
}
