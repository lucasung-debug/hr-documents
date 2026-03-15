/**
 * Recalculate signature positions from existing detect_*.pdf files.
 * No Sheets API calls — uses already-generated PDFs with XSIGX marker.
 *
 * Signature size = text size * 1.1 (10% larger), centered on text.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const SIG_MARKER = 'XSIGX'
const SCALE = 1.5

const outputDir = path.join(__dirname, 'calibration-output')
const configPath = path.join(ROOT, 'config', 'signature-positions.json')
const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

async function findMarkers(pdfPath) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data }).promise
  const results = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const item of tc.items) {
      if (!item.str?.includes(SIG_MARKER)) continue
      results.push({
        page: p - 1,
        x: item.transform[4],
        y: item.transform[5],
        textWidth: item.width || 20,
        textHeight: item.height || 10,
      })
    }
  }
  return results
}

const docs = [
  'labor_contract_monthly', 'labor_contract_daily',
  'personal_info_consent', 'bank_account', 'health_certificate',
  'criminal_check_consent', 'emergency_contact', 'data_security_pledge',
]

const allDetected = {}

for (const key of docs) {
  const pdfPath = path.join(outputDir, `detect_${key}.pdf`)
  if (!fs.existsSync(pdfPath)) { console.log(`[SKIP] ${key}: no PDF`); continue }

  console.log(`--- ${key} ---`)
  const markers = await findMarkers(pdfPath)

  if (markers.length === 0) {
    console.log('  No markers found')
    continue
  }

  const positions = markers.map(m => {
    const sigW = Math.round(m.textWidth * SCALE)
    const sigH = Math.round(m.textHeight * SCALE)
    const textCenterX = m.x + m.textWidth / 2
    const textCenterY = m.y + m.textHeight / 2
    const sigX = Math.round(textCenterX - sigW / 2)
    const sigY = Math.round(textCenterY - sigH / 2)
    console.log(`  text: page=${m.page}, x=${m.x.toFixed(1)}, y=${m.y.toFixed(1)}, w=${m.textWidth.toFixed(1)}, h=${m.textHeight.toFixed(1)}`)
    console.log(`    → sig: x=${sigX}, y=${sigY}, w=${sigW}, h=${sigH}`)
    return { page: m.page, x: sigX, y: sigY, width: sigW, height: sigH }
  })

  allDetected[key] = positions.length === 1 ? positions[0] : positions
}

// labor_contract fallback
if (allDetected.labor_contract_monthly) {
  allDetected.labor_contract = allDetected.labor_contract_monthly
}

console.log('\n=== Updated Positions ===')
console.log(JSON.stringify(allDetected, null, 2))

// Merge
const merged = { _comment: existing._comment }
const allKeys = ['labor_contract', 'labor_contract_monthly', 'labor_contract_daily',
  'personal_info_consent', 'bank_account', 'health_certificate',
  'criminal_check_consent', 'emergency_contact', 'data_security_pledge']

for (const key of allKeys) {
  const det = allDetected[key]
  const old = existing[key]
  if (det) {
    if (Array.isArray(det)) {
      merged[key] = det.map(p => ({ ...p }))
    } else {
      merged[key] = {
        ...det,
        ...(old?.sheets_row != null ? { sheets_row: old.sheets_row } : {}),
        ...(old?._note ? { _note: old._note } : {}),
      }
    }
  } else {
    merged[key] = old
  }
}

// Backup & save
fs.writeFileSync(path.join(outputDir, 'signature-positions.backup.json'), JSON.stringify(existing, null, 2))
fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n')
console.log(`\nSaved: ${configPath}`)
