import { PDFDocument } from 'pdf-lib'

export interface PdfPacketAttachment {
  filename?: string
  content: Buffer | Uint8Array
  contentType: string
}

export async function buildOnboardingPdfPacket(
  attachments: readonly PdfPacketAttachment[]
): Promise<Buffer> {
  const merged = await PDFDocument.create()
  const pdfAttachments = attachments.filter(
    (attachment) => attachment.contentType === 'application/pdf'
  )

  for (const attachment of pdfAttachments) {
    const source = await PDFDocument.load(attachment.content)
    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) {
      merged.addPage(page)
    }
  }

  return Buffer.from(await merged.save())
}
