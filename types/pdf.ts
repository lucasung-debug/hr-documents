import type { DocumentKey } from './document'

export interface SignaturePosition {
  page: number   // 0-indexed page number
  x: number      // Distance from left edge in PDF points (1pt = 1/72 inch)
  y: number      // Distance from BOTTOM edge in PDF points (pdf-lib coordinate system)
  width: number  // Signature image width in PDF points
  height: number // Signature image height in PDF points
}

// Includes base DocumentKey entries plus labor_contract_monthly / _daily variants
export type SignaturePositionKey = DocumentKey | 'labor_contract_monthly' | 'labor_contract_daily'
// Each document can have one or multiple signature positions
export type SignaturePositionConfig = Record<SignaturePositionKey, SignaturePosition | SignaturePosition[]>

export interface PdfGenerationResult {
  documentKey: DocumentKey
  tempFilePath: string
  previewImagePath: string
  fileSizeBytes: number
  success: boolean
  error?: string
}

export interface PdfPreviewResult {
  documentKey: DocumentKey
  previewImagePath: string
  previewBase64?: string
  success: boolean
  error?: string
}
