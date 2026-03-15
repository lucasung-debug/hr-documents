/**
 * Signature Position Calibration Script
 *
 * Loads each PDF template and draws a red rectangle at the configured
 * signature position so you can visually verify placement.
 *
 * Usage: node scripts/calibrate-signature.mjs
 * Output: scripts/calibration-output/<docKey>_calibrated.pdf
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const configPath = path.join(ROOT, 'config', 'signature-positions.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const templateDir = path.join(ROOT, 'public', 'templates')
const outputDir = path.join(__dirname, 'calibration-output')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Map config keys to template PDF files
const keyToFile = {
  labor_contract: 'labor_contract.pdf',
  labor_contract_monthly: 'labor_contract.pdf',
  labor_contract_daily: 'labor_contract.pdf',
  personal_info_consent: 'personal_info_consent.pdf',
  bank_account: 'bank_account.pdf',
  health_certificate: 'health_certificate.pdf',
  criminal_check_consent: 'criminal_check_consent.pdf',
  emergency_contact: 'emergency_contact.pdf',
  data_security_pledge: 'data_security_pledge.pdf',
}

async function calibrate(docKey) {
  const pos = config[docKey]
  if (!pos || pos.page === undefined) {
    console.log(`  [SKIP] ${docKey}: no position config`)
    return
  }

  const fileName = keyToFile[docKey]
  if (!fileName) {
    console.log(`  [SKIP] ${docKey}: no template file mapping`)
    return
  }

  const pdfPath = path.join(templateDir, fileName)
  if (!fs.existsSync(pdfPath)) {
    console.log(`  [SKIP] ${docKey}: template not found at ${pdfPath}`)
    return
  }

  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()

  if (pos.page >= pages.length) {
    console.log(`  [WARN] ${docKey}: page ${pos.page} does not exist (total: ${pages.length})`)
    // Still save to show the issue
  } else {
    const page = pages[pos.page]
    const { width: pageW, height: pageH } = page.getSize()

    // Draw red rectangle outline at the signature position
    const borderWidth = 2
    page.drawRectangle({
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      borderColor: rgb(1, 0, 0),
      borderWidth,
      color: rgb(1, 0, 0),
      opacity: 0.15,
    })

    // Draw crosshair at center
    const cx = pos.x + pos.width / 2
    const cy = pos.y + pos.height / 2
    page.drawLine({
      start: { x: cx - 15, y: cy },
      end: { x: cx + 15, y: cy },
      color: rgb(1, 0, 0),
      thickness: 1,
    })
    page.drawLine({
      start: { x: cx, y: cy - 15 },
      end: { x: cx, y: cy + 15 },
      color: rgb(1, 0, 0),
      thickness: 1,
    })

    console.log(`  [OK] ${docKey}: page=${pos.page}, x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height} (pageSize: ${pageW.toFixed(0)}x${pageH.toFixed(0)})`)
  }

  const outPath = path.join(outputDir, `${docKey}_calibrated.pdf`)
  const savedBytes = await pdfDoc.save()
  fs.writeFileSync(outPath, savedBytes)
}

console.log('Signature Position Calibration')
console.log('==============================')
console.log(`Config: ${configPath}`)
console.log(`Templates: ${templateDir}`)
console.log(`Output: ${outputDir}\n`)

for (const docKey of Object.keys(keyToFile)) {
  await calibrate(docKey)
}

console.log(`\nDone! Check PDFs in: ${outputDir}`)
