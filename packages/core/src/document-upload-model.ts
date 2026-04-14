export const documentUploadStatuses = ['received', 'processing', 'accepted', 'rejected'] as const;
export type DocumentUploadStatus = (typeof documentUploadStatuses)[number];

export const documentUploadAllowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'text/plain'
] as const;
export type DocumentUploadAllowedMimeType = (typeof documentUploadAllowedMimeTypes)[number];

export const documentUploadMaxSizeBytes = 10 * 1024 * 1024;

export const documentUploadModel = {
  canonicalArtifact: 'packages/core/src/document-upload-model.ts',
  statuses: documentUploadStatuses,
  allowedMimeTypes: documentUploadAllowedMimeTypes,
  maxSizeBytes: documentUploadMaxSizeBytes,
  storagePathTemplate: 'data/dev/uploads/<leadId>/<documentId>-<originalFilename>',
  fields: [
    'documentId',
    'leadId',
    'originalFilename',
    'storedFilename',
    'mimeType',
    'sizeBytes',
    'status',
    'uploadedAt',
    'reviewedAt',
    'reviewedBy',
    'reviewNote'
  ]
} as const;

export type DocumentUploadRecord = {
  documentId: string;
  leadId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentUploadStatus;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};
