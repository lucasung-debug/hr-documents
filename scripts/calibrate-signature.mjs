/**
 * Signature Position Calibration Script
 *
 * Loads each PDF template and draws red rectangles at the configured
 * signature positions so you can visually verify placement.
 *
 * Usage:
 *   node scripts/calibrate-signature.mjs           # Legacy PDFs (public/templates/)
 *   node scripts/calibrate-signature.mjs --sheets   # Sheets example PDFs (example_template_print/)
 *
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

const outputDir = path.join(__dirname, 'calibration-output')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const useSheets = process.argv.includes('--sheets')

// Legacy PDFs in public/templates/
const legacyKeyToFile = {
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

// Sheets example PDFs in example_template_print/
const sheetsKeyToFile = {
  labor_contract: 'labor_contract_monthly_exam.pdf',
  labor_contract_monthly: 'labor_contract_monthly_exam.pdf',
  labor_contract_daily: 'labor_contract_daily_exam.pdf',
  personal_info_consent: 'personal_information_exam.pdf',
  holiday_extension: 'hoilday_extension_exam.pdf',
  data_security_pledge: 'security_pledge_exam.pdf',
  compliance: 'compliance_exam.pdf',
  overtime_work: 'overtime_work_exam.pdf',
}

const keyToFile = useSheets ? sheetsKeyToFile : legacyKeyToFile
const templateDir = useSheets
  ? path.join(ROOT, 'example_template_print')
  : path.join(ROOT, 'public', 'templates')

function drawMarker(page, pos, label) {
  page.drawRectangle({
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    borderColor: rgb(1, 0, 0),
    borderWidth: 2,
    color: rgb(1, 0, 0),
    opacity: 0.15,
  })

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

  page.drawText(label, {
    x: pos.x,
    y: pos.y + pos.height + 3,
    size: 7,
    color: rgb(1, 0, 0),
  })
}

async function calibrate(docKey) {
  const positions = config[docKey]
  if (!positions) {
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

  // Normalize to array
  const posArr = Array.isArray(positions) ? positions : [positions]

  console.log(`  ${docKey}: ${posArr.length} position(s), ${pages.length} page(s)`)
  for (let i = 0; i < posArr.length; i++) {
    const pos = posArr[i]
    if (pos.page >= pages.length) {
      console.log(`    #${i + 1}: [WARN] page ${pos.page} does not exist (total: ${pages.length})`)
      continue
    }

    const page = pages[pos.page]
    const { width: pageW, height: pageH } = page.getSize()
    drawMarker(page, pos, `#${i + 1} (p${pos.page})`)
    console.log(`    #${i + 1}: page=${pos.page}, x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height} (pageSize: ${pageW.toFixed(0)}x${pageH.toFixed(0)})`)
  }

  const prefix = useSheets ? 'sheets_' : ''
  const outPath = path.join(outputDir, `${prefix}${docKey}_calibrated.pdf`)
  fs.writeFileSync(outPath, await pdfDoc.save())
}

const mode = useSheets ? 'Sheets example PDFs' : 'Legacy PDFs'
console.log('Signature Position Calibration')
console.log('==============================')
console.log(`Mode: ${mode}`)
console.log(`Config: ${configPath}`)
console.log(`Templates: ${templateDir}`)
console.log(`Output: ${outputDir}\n`)

for (const docKey of Object.keys(keyToFile)) {
  await calibrate(docKey)
}

console.log(`\nDone! Check PDFs in: ${outputDir}`)
