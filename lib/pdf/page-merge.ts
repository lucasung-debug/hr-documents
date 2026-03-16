import { PDFDocument } from 'pdf-lib'

/**
 * Merge multiple PDF buffers into one multi-page PDF.
 * Takes only the first page from each buffer to avoid
 * extra blank pages from Google Sheets export.
 */
export async function mergePdfPages(pageBuffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create()

  for (const buf of pageBuffers) {
    const doc = await PDFDocument.load(buf)
    const [page] = await merged.copyPages(doc, [0])
    merged.addPage(page)
  }

  return Buffer.from(await merged.save())
}
