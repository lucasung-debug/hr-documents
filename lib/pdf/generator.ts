import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import type { DocumentKey } from '@/types/document'
import type { PdfGenerationResult } from '@/types/pdf'
import { getSignaturePositionConfig } from './signature-config'
import { getPdfPath, ensureSessionDir } from '@/lib/storage/temp-files'

function getTemplatePath(documentKey: DocumentKey): string {
  return path.join(process.cwd(), 'public', 'templates', `${documentKey}.pdf`)
}

export async function generateSignedPdf(
  employeeId: string,
  documentKey: DocumentKey,
  signatureBuffer: Buffer
): Promise<PdfGenerationResult> {
  const templatePath = getTemplatePath(documentKey)
  const outputPath = getPdfPath(employeeId, documentKey)

  if (!fs.existsSync(templatePath)) {
    return {
      documentKey,
      tempFilePath: '',
      previewImagePath: '',
      fileSizeBytes: 0,
      success: false,
      error: `Template not found: ${documentKey}.pdf`,
    }
  }

  try {
    const templateBytes = fs.readFileSync(templatePath)
    const pdfDoc = await PDFDocument.load(templateBytes)
    const pages = pdfDoc.getPages()

    const config = getSignaturePositionConfig()
    const positionData = config[documentKey]
    const positions = Array.isArray(positionData) ? positionData : [positionData]

    const sigImage = await pdfDoc.embedPng(signatureBuffer)

    for (const position of positions) {
      if (position.page >= pages.length) {
        return {
          documentKey,
          tempFilePath: '',
          previewImagePath: '',
          fileSizeBytes: 0,
          success: false,
          error: `Page index ${position.page} out of range (document has ${pages.length} pages)`,
        }
      }

      const targetPage = pages[position.page]
      targetPage.drawImage(sigImage, {
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      })
    }

    const pdfBytes = await pdfDoc.save()
    ensureSessionDir(employeeId)
    fs.writeFileSync(outputPath, pdfBytes)

    return {
      documentKey,
      tempFilePath: outputPath,
      previewImagePath: '',
      fileSizeBytes: pdfBytes.length,
      success: true,
    }
  } catch (err) {
    return {
      documentKey,
      tempFilePath: '',
      previewImagePath: '',
      fileSizeBytes: 0,
      success: false,
      error: err instanceof Error ? err.message : 'PDF generation failed',
    }
  }
}

export async function generateAllSignedPdfs(
  employeeId: string,
  signatureBuffer: Buffer,
  documentKeys: DocumentKey[]
): Promise<PdfGenerationResult[]> {
  return Promise.all(
    documentKeys.map((key) => generateSignedPdf(employeeId, key, signatureBuffer))
  )
}
