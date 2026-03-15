/**
 * Verify detected signature positions by drawing red markers
 * on the actual Sheets-generated PDFs (with XSIGX marker text).
 *
 * Usage: node scripts/verify-positions.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const configPath = path.join(ROOT, 'config', 'signature-positions.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const outputDir = path.join(__dirname, 'calibration-output')

const docs = [
  'labor_contract_monthly', 'labor_contract_daily',
  'personal_info_consent', 'bank_account', 'health_certificate',
  'criminal_check_consent', 'emergency_contact', 'data_security_pledge',
]

function drawMarker(page, pos, label) {
  page.drawRectangle({
    x: pos.x, y: pos.y, width: pos.width, height: pos.height,
    borderColor: rgb(1, 0, 0), borderWidth: 2,
    color: rgb(1, 0, 0), opacity: 0.15,
  })
  const cx = pos.x + pos.width / 2, cy = pos.y + pos.height / 2
  page.drawLine({ start: { x: cx - 15, y: cy }, end: { x: cx + 15, y: cy }, color: rgb(1, 0, 0), thickness: 1 })
  page.drawLine({ start: { x: cx, y: cy - 15 }, end: { x: cx, y: cy + 15 }, color: rgb(1, 0, 0), thickness: 1 })
  page.drawText(label, { x: pos.x, y: pos.y + pos.height + 3, size: 7, color: rgb(1, 0, 0) })
}

for (const key of docs) {
  const srcPath = path.join(outputDir, `detect_${key}.pdf`)
  if (!fs.existsSync(srcPath)) { console.log(`[SKIP] ${key}: no source PDF`); continue }

  const positions = config[key]
  const posArr = Array.isArray(positions) ? positions : positions ? [positions] : []
  if (posArr.length === 0) { console.log(`[SKIP] ${key}: no config`); continue }

  const pdfDoc = await PDFDocument.load(fs.readFileSync(srcPath))
  const pages = pdfDoc.getPages()

  console.log(`${key}: ${posArr.length} position(s), ${pages.length} page(s)`)
  for (let i = 0; i < posArr.length; i++) {
    const pos = posArr[i]
    if (pos.page < pages.length) {
      drawMarker(pages[pos.page], pos, `#${i + 1} (p${pos.page})`)
      console.log(`  #${i + 1}: page=${pos.page}, x=${pos.x}, y=${pos.y}`)
    } else {
      console.log(`  #${i + 1}: page ${pos.page} out of range!`)
    }
  }

  const outPath = path.join(outputDir, `verify_${key}.pdf`)
  fs.writeFileSync(outPath, await pdfDoc.save())
  console.log(`  → ${outPath}\n`)
}

console.log('Done! Open verify_*.pdf files to check red markers align with XSIGX text.')
