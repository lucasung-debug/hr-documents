import fs from 'fs'
import path from 'path'
import type { DocumentKey } from '@/types/document'
import { getPreviewPath, getPdfPath, ensureSessionDir } from '@/lib/storage/temp-files'

// A4 at 96 DPI: 794 × 1123 px
const A4_WIDTH = 794
const A4_HEIGHT = 1123

async function getBrowser() {
  if (process.env.VERCEL) {
    // Vercel: use @sparticuz/chromium to stream Chrome from S3
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // Docker / local: use system Chromium or bundled Puppeteer
    const puppeteer = await import('puppeteer')
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
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
