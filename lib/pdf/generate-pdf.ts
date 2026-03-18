import type { DocumentKey } from '@/types/document'
import type { PaySection } from '@/types/employee'
import { createLogger } from '@/lib/logger'

const log = createLogger('[pdf/generate-pdf]')

/**
 * Unified PDF generation entry point.
 *
 * Delegates to either:
 * - Local pdf-lib generator (USE_LOCAL_PDF=true) — fast, no external deps
 * - Google Sheets template pipeline (default) — existing behavior
 *
 * Both return identical Buffer output compatible with embedSignatureInPdf().
 */
export async function generatePdf(
  documentKey: DocumentKey,
  variables: Record<string, string>,
  paySec?: PaySection
): Promise<Buffer> {
  const useLocal = process.env.USE_LOCAL_PDF === 'true'

  if (useLocal) {
    const { generatePdfLocal } = await import('./local-generator')
    log.info({ documentKey }, 'Generating PDF locally (pdf-lib)')
    return generatePdfLocal(documentKey, variables, paySec)
  }

  const { generatePdfFromTemplate } = await import('@/lib/sheets/template')
  log.info({ documentKey }, 'Generating PDF from Google Sheets template')
  return generatePdfFromTemplate(documentKey, variables, paySec)
}
