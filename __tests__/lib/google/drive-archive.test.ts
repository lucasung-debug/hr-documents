import {
  archiveOnboardingPdfPacket,
  createSafeArchiveFilename,
  safelyArchiveOnboardingPdfPacket,
  shouldArchivePdfPacket,
  type DriveArchiveUploadClient,
} from '@/lib/google/drive-archive'
import { createGoogleDriveArchiveUploadClient } from '@/lib/google/drive-client'

const employeePii = {
  name: 'Kim Sensitive',
  phone: '010-1234-5678',
  email: 'kim@example.com',
}

describe('Drive archive adapter', () => {
  const fixedNow = new Date('2026-05-23T12:34:56.000Z')

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID
  })

  it('creates a filename from only the case id and document label', () => {
    const inputWithExtraPii = {
      case_id: 'ONB-E001',
      documentLabel: 'onboarding-packet',
      ...employeePii,
    }
    const filename = createSafeArchiveFilename(inputWithExtraPii as any)

    expect(filename).toBe('ONB-E001-onboarding-packet.pdf')
    expect(filename).not.toContain(employeePii.name)
    expect(filename).not.toContain(employeePii.phone)
    expect(filename).not.toContain(employeePii.email)
  })

  it('uploads a private PDF to the configured folder and returns only archive metadata', async () => {
    process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID = 'folder-123'
    const upload = jest.fn().mockResolvedValue({
      id: 'drive-file-123',
      webViewLink: 'https://drive.google.com/private-view',
      webContentLink: 'https://drive.google.com/private-download',
    })
    const client: DriveArchiveUploadClient = { uploadPdf: upload }

    const result = await archiveOnboardingPdfPacket({
      case_id: 'ONB-E001',
      pdf: Buffer.from('%PDF-1.4'),
      uploadClient: client,
      now: () => fixedNow,
    })

    expect(upload).toHaveBeenCalledWith({
      folderId: 'folder-123',
      filename: 'ONB-E001-onboarding-packet.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-1.4'),
    })
    expect(result).toEqual({
      drive_file_id: 'drive-file-123',
      drive_archived_at: '2026-05-23T12:34:56.000Z',
      workspace_sync_status: 'synced',
    })
    expect(result).not.toHaveProperty('webViewLink')
    expect(result).not.toHaveProperty('webContentLink')
  })

  it('does not request public permissions or public links', async () => {
    process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID = 'folder-123'
    const upload = jest.fn().mockResolvedValue({ id: 'drive-file-123' })
    const createPublicPermission = jest.fn()
    const client: DriveArchiveUploadClient = {
      uploadPdf: upload,
      createPublicPermission,
    }

    await archiveOnboardingPdfPacket({
      case_id: 'ONB-E001',
      pdf: Buffer.from('%PDF-1.4'),
      uploadClient: client,
      now: () => fixedNow,
    })

    expect(createPublicPermission).not.toHaveBeenCalled()
    expect(upload.mock.calls[0][0]).not.toHaveProperty('fields')
  })

  it('fails with a safe configuration error when the archive folder is missing', async () => {
    const upload = jest.fn()
    const client: DriveArchiveUploadClient = { uploadPdf: upload }

    await expect(
      archiveOnboardingPdfPacket({
        case_id: 'ONB-E001',
        pdf: Buffer.from('%PDF-1.4'),
        uploadClient: client,
        now: () => fixedNow,
      })
    ).rejects.toThrow('Missing required environment variable: GOOGLE_DRIVE_ARCHIVE_FOLDER_ID')

    expect(upload).not.toHaveBeenCalled()
  })

  it('maps missing folder failures to configuration_error without throwing', async () => {
    const upload = jest.fn()
    const client: DriveArchiveUploadClient = { uploadPdf: upload }

    const result = await safelyArchiveOnboardingPdfPacket({
      case_id: 'ONB-E001',
      pdf: Buffer.from('%PDF-1.4'),
      uploadClient: client,
      now: () => fixedNow,
    })

    expect(result).toEqual({
      ok: false,
      code: 'configuration_error',
      message: 'Missing required environment variable: GOOGLE_DRIVE_ARCHIVE_FOLDER_ID',
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it('maps upload failures to upload_failed without leaking the original error', async () => {
    process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID = 'folder-123'
    const upload = jest.fn().mockRejectedValue(new Error('permission denied for sensitive folder'))
    const client: DriveArchiveUploadClient = { uploadPdf: upload }

    const result = await safelyArchiveOnboardingPdfPacket({
      case_id: 'ONB-E001',
      pdf: Buffer.from('%PDF-1.4'),
      uploadClient: client,
      now: () => fixedNow,
    })

    expect(result).toEqual({
      ok: false,
      code: 'upload_failed',
      message: 'Drive archive upload failed',
    })
  })

  it('skips archive work when a case already has a Drive file id', async () => {
    expect(shouldArchivePdfPacket({ drive_file_id: 'drive-file-123' })).toBe(false)
    expect(shouldArchivePdfPacket({ drive_file_id: '' })).toBe(true)
    expect(shouldArchivePdfPacket({ drive_file_id: '   ' })).toBe(true)
    expect(shouldArchivePdfPacket({})).toBe(true)
  })

  it('uses private Drive file creation options for real uploads', async () => {
    const create = jest.fn().mockResolvedValue({ data: { id: 'drive-file-123' } })
    const permissionsCreate = jest.fn()
    const drive = {
      files: { create },
      permissions: { create: permissionsCreate },
    }

    const client = createGoogleDriveArchiveUploadClient(drive as any)
    const result = await client.uploadPdf({
      folderId: 'folder-123',
      filename: 'ONB-E001-onboarding-packet.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-1.4'),
    })

    expect(result).toEqual({ id: 'drive-file-123' })
    expect(create).toHaveBeenCalledWith({
      requestBody: {
        name: 'ONB-E001-onboarding-packet.pdf',
        parents: ['folder-123'],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: expect.any(Object),
      },
      fields: 'id',
      supportsAllDrives: true,
    })
    expect(permissionsCreate).not.toHaveBeenCalled()
  })
})
