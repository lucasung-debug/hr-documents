import { PDFDocument } from 'pdf-lib'
import { getSignaturePositionConfig } from './signature-config'
import type { DocumentKey } from '@/types/document'
import type { PaySection } from '@/types/employee'
import { createLogger } from '@/lib/logger'

const log = createLogger('[pdf/embed-signature]')

/**
 * Embed a PNG signature image into a PDF buffer.
 * Returns the modified PDF as Uint8Array.
 */
export async function embedSignatureInPdf(
  pdfBuffer: Buffer,
  signatureBuffer: Buffer,
  documentKey: DocumentKey,
  paySec?: PaySection
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const pages = pdfDoc.getPages()

  const config = getSignaturePositionConfig()
  const posKey = documentKey === 'labor_contract'
    ? `labor_contract_${paySec ?? 'monthly'}` as const
    : documentKey
  const position = config[posKey] ?? config[documentKey]

  const positions = Array.isArray(position) ? position : position ? [position] : []
  if (positions.length > 0) {
    const sigImage = await pdfDoc.embedPng(signatureBuffer)
    for (const pos of positions) {
      if (pos.page < pages.length) {
        pages[pos.page].drawImage(sigImage, {
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
        })
      } else {
        log.warn({ documentKey, posKey, page: pos.page, totalPages: pages.length },
          'Signature position references non-existent page')
      }
    }
  }

  return pdfDoc.save()
}
