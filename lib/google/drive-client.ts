import { Readable } from 'stream'
import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'
import { getAuthClient } from '@/lib/sheets/client'
import type { DriveArchiveUploadClient, DrivePdfUploadInput } from './drive-archive'

let driveClient: drive_v3.Drive | null = null

export function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient

  const auth = getAuthClient()
  driveClient = google.drive({ version: 'v3', auth })
  return driveClient
}

export function createGoogleDriveArchiveUploadClient(
  drive: drive_v3.Drive = getDriveClient()
): DriveArchiveUploadClient {
  return {
    async uploadPdf(input: DrivePdfUploadInput): Promise<{ id: string }> {
      const response = await drive.files.create({
        requestBody: {
          name: input.filename,
          parents: [input.folderId],
          mimeType: input.mimeType,
        },
        media: {
          mimeType: input.mimeType,
          body: Readable.from(input.content),
        },
        fields: 'id',
        supportsAllDrives: true,
      })

      const id = response.data.id
      if (!id) {
        throw new Error('Drive upload did not return a file id')
      }

      return { id }
    },
  }
}
