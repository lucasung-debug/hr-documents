import { createGoogleDriveArchiveUploadClient } from './drive-client'

const PDF_MIME_TYPE = 'application/pdf'
const DEFAULT_DOCUMENT_LABEL = 'onboarding-packet'

export interface SafeArchiveFilenameInput {
  case_id: string
  documentLabel?: string
}

export interface DrivePdfUploadInput {
  folderId: string
  filename: string
  mimeType: typeof PDF_MIME_TYPE
  content: Buffer
}

export interface DriveArchiveUploadClient {
  uploadPdf(input: DrivePdfUploadInput): Promise<{ id: string }>
  createPublicPermission?(fileId: string): Promise<unknown>
}

export interface ArchiveOnboardingPdfPacketInput {
  case_id: string
  pdf: Buffer
  uploadClient?: DriveArchiveUploadClient
  folderId?: string
  now?: () => Date
}

export interface DriveArchiveMetadata {
  drive_file_id: string
  drive_archived_at: string
  workspace_sync_status: 'synced'
}

export type DriveArchiveFailureCode = 'configuration_error' | 'upload_failed'

export interface DriveArchiveFailure {
  ok: false
  code: DriveArchiveFailureCode
  message: string
}

export type DriveArchiveResult =
  | ({ ok: true } & DriveArchiveMetadata)
  | DriveArchiveFailure

export function createSafeArchiveFilename(input: SafeArchiveFilenameInput): string {
  const caseId = normalizeFilenameToken(input.case_id)
  const documentLabel = normalizeFilenameToken(input.documentLabel ?? DEFAULT_DOCUMENT_LABEL)

  if (!caseId) {
    throw new Error('Missing required archive filename case id')
  }

  return `${caseId}-${documentLabel || DEFAULT_DOCUMENT_LABEL}.pdf`
}

export function shouldArchivePdfPacket(caseLike: { drive_file_id?: string | null }): boolean {
  return !caseLike.drive_file_id?.trim()
}

export async function archiveOnboardingPdfPacket(
  input: ArchiveOnboardingPdfPacketInput
): Promise<DriveArchiveMetadata> {
  const folderId = input.folderId ?? process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID
  if (!folderId) {
    throw new Error('Missing required environment variable: GOOGLE_DRIVE_ARCHIVE_FOLDER_ID')
  }

  const uploadClient = input.uploadClient ?? createGoogleDriveArchiveUploadClient()
  const filename = createSafeArchiveFilename({ case_id: input.case_id })

  try {
    const uploaded = await uploadClient.uploadPdf({
      folderId,
      filename,
      mimeType: PDF_MIME_TYPE,
      content: input.pdf,
    })

    return {
      drive_file_id: uploaded.id,
      drive_archived_at: (input.now ?? (() => new Date()))().toISOString(),
      workspace_sync_status: 'synced',
    }
  } catch (error: unknown) {
    throw new Error('Drive archive upload failed')
  }
}

export async function safelyArchiveOnboardingPdfPacket(
  input: ArchiveOnboardingPdfPacketInput
): Promise<DriveArchiveResult> {
  try {
    return {
      ok: true,
      ...(await archiveOnboardingPdfPacket(input)),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Drive archive upload failed'
    return {
      ok: false,
      code: message.includes('GOOGLE_DRIVE_ARCHIVE_FOLDER_ID')
        ? 'configuration_error'
        : 'upload_failed',
      message,
    }
  }
}

function normalizeFilenameToken(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
