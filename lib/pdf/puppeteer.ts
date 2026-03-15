import fs from 'fs'
import path from 'path'
import type { DocumentKey } from '@/types/document'
import { getPreviewPath, getPdfPath, ensureSessionDir } from '@/lib/storage/temp-files'
import { createLogger } from '@/lib/logger'

const log = createLogger('[pdf/puppeteer]')

// A4 at 96 DPI: 794 × 1123 px
const A4_WIDTH = 794
const A4_HEIGHT = 1123

async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    const puppeteer = await import('puppeteer')
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
}

export interface PreviewResult {
  type: 'png' | 'pdf'
  dataUrl: string
}

export async function generatePreviewImage(
  employeeId: string,
  documentKey: DocumentKey
): Promise<string> {
  const pdfPath = getPdfPath(employeeId, documentKey)
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found for preview: ${documentKey}`)
  }

  const previewPath = getPreviewPath(employeeId, documentKey)
  ensureSessionDir(employeeId)

  const browser = await getBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: A4_WIDTH, height: A4_HEIGHT })

    const fileUrl = `file://${path.resolve(pdfPath)}`
    await page.goto(fileUrl, { waitUntil: 'networkidle0' })

    await page.screenshot({
      path: previewPath as `${string}.png`,
      type: 'png',
      clip: { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT },
    })

    return previewPath
  } finally {
    await browser.close()
  }
}

export async function previewToBase64(previewPath: string): Promise<string> {
  const buffer = fs.readFileSync(previewPath)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

/**
 * Fallback: return PDF itself as base64 data URL when Puppeteer fails.
 */
export function pdfToBase64DataUrl(employeeId: string, documentKey: DocumentKey): PreviewResult {
  const pdfPath = getPdfPath(employeeId, documentKey)
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found for fallback preview: ${documentKey}`)
  }
  const buffer = fs.readFileSync(pdfPath)
  return {
    type: 'pdf',
    dataUrl: `data:application/pdf;base64,${buffer.toString('base64')}`,
  }
}

/**
 * Return signed PDF as base64 data URL for preview.
 * Puppeteer headless rendering produces black images, so we serve the PDF directly.
 * The preview page supports PDF type via <object>/<iframe>.
 */
export async function generatePreviewWithFallback(
  employeeId: string,
  documentKey: DocumentKey
): Promise<PreviewResult> {
  return pdfToBase64DataUrl(employeeId, documentKey)
}
