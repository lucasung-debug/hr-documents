/**
 * Auto-detect {{signature}} positions in all Sheets-generated PDFs.
 *
 * Strategy:
 * 1. For each document template, fill {{signature}} with a unique marker "XSIGX"
 * 2. Export PDF from Sheets
 * 3. Use pdfjs-dist to find the marker text position in the PDF
 * 4. Output detected coordinates & update signature-positions.json
 *
 * Usage: node scripts/detect-signature-positions.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { google } from 'googleapis'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Load .env.local
const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID
const CLIENT_ID = process.env.GMAIL_CLIENT_ID
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const REFRESH_TOKEN = process.env.GMAIL_CLIENT_REFRESH_TOKEN
const SHEET_EMPLOYEE_MASTER = process.env.SHEET_EMPLOYEE_MASTER || 'EMPLOYEE_MASTER'

if (!SPREADSHEET_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Missing env vars'); process.exit(1)
}

const SIG_MARKER = 'XSIGX'

// --- Google API ---
function getAuth() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  auth.setCredentials({ refresh_token: REFRESH_TOKEN })
  return auth
}
function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

async function getSheetGid(sheetName) {
  const sheets = getSheetsClient()
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties',
  })
  const sheet = (meta.data.sheets ?? []).find(s => s.properties?.title === sheetName)
  if (sheet?.properties?.sheetId == null) throw new Error(`Sheet not found: ${sheetName}`)
  return sheet.properties.sheetId
}

async function exportPdf(gid) {
  const auth = getAuth()
  const { token } = await auth.getAccessToken()
  const params = new URLSearchParams({
    format: 'pdf', gid: String(gid), size: 'A4', portrait: 'true',
    scale: '2', gridlines: 'false', printtitle: 'false', sheetnames: 'false',
    fzr: 'false', top_margin: '0.25', bottom_margin: '0.25',
    left_margin: '0.25', right_margin: '0.25',
  })
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function getFirstEmployee() {
  const sheets = getSheetsClient()
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${SHEET_EMPLOYEE_MASTER}!A:Z`,
  })
  const rows = result.data.values ?? []
  if (rows.length < 2) throw new Error('No employees')
  const headers = rows[0]; const row = rows[1]; const emp = {}
  headers.forEach((h, i) => { emp[h] = row[i] || '' })
  return emp
}

// --- Template generation with marker ---
async function generatePdfWithMarker(templateSheetName, variables) {
  const sheets = getSheetsClient()
  const workName = `WORK_detect_${Date.now()}`

  const templateGid = await getSheetGid(templateSheetName)
  const copyResult = await sheets.spreadsheets.sheets.copyTo({
    spreadsheetId: SPREADSHEET_ID, sheetId: templateGid,
    requestBody: { destinationSpreadsheetId: SPREADSHEET_ID },
  })
  const copiedId = copyResult.data.sheetId

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ updateSheetProperties: {
      properties: { sheetId: copiedId, title: workName }, fields: 'title',
    }}]},
  })

  const readResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${workName}!A:Z`,
  })
  const data = readResult.data.values ?? []

  const filled = data.map(row => row.map(cell => {
    let r = cell
    for (const [k, v] of Object.entries(variables)) {
      r = r.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    }
    return r
  }))

  if (filled.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `${workName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: filled },
    })
  }

  const workGid = await getSheetGid(workName)
  const pdf = await exportPdf(workGid)

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ deleteSheet: { sheetId: copiedId } }] },
  }).catch(() => {})

  return pdf
}

// --- PDF text position detection via pdfjs-dist ---
async function findMarkerInPdf(pdfBuffer, marker) {
  // pdfjs-dist requires specific import for Node
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')

  const data = new Uint8Array(pdfBuffer)
  const doc = await pdfjsLib.getDocument({ data }).promise

  const results = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })
    const textContent = await page.getTextContent()

    for (const item of textContent.items) {
      if (!item.str || !item.str.includes(marker)) continue

      // item.transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const tx = item.transform[4]
      const ty = item.transform[5]

      // pdfjs uses top-left origin for viewport, but transform gives bottom-left
      // The y in transform is from bottom of page in PDF coordinates
      results.push({
        page: pageNum - 1, // 0-indexed
        x: tx,
        y: ty,
        text: item.str,
        width: item.width,
        height: item.height,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
      })
    }
  }

  return results
}

// --- Main ---
async function main() {
  console.log('=== Auto-detect {{signature}} positions ===\n')

  const employee = await getFirstEmployee()
  console.log(`Employee: ${employee.name} (${employee.employee_id}), pay_sec: ${employee.pay_sec || 'monthly'}\n`)

  const today = new Date()
  const pad = n => String(n).padStart(2, '0')

  const baseVars = {
    employee_name: employee.name || '', name: employee.name || '',
    department: employee.department || '', position: employee.position || '',
    hire_date: employee.hire_date || '', adrress: employee.address || '',
    birthday: employee.birthday || '',
    date_yy: String(today.getFullYear()), date_mm: pad(today.getMonth() + 1),
    date_dd: pad(today.getDate()),
    signature: SIG_MARKER, // <-- marker instead of empty
  }

  try {
    const parts = (employee.hire_date || '').replace(/[^0-9.]/g, '').split('.')
    baseVars.hire_date_yy = parts[0] || String(today.getFullYear())
    baseVars.hire_date_mm = pad(parseInt(parts[1] || '1', 10))
    baseVars.hire_date_dd = pad(parseInt(parts[2] || '1', 10))
  } catch {}

  // All document templates to check
  const documents = [
    { key: 'labor_contract_monthly', sheet: 'TPL_labor_contract_monthly', configKey: 'labor_contract_monthly' },
    { key: 'labor_contract_daily', sheet: 'TPL_labor_contract_daily', configKey: 'labor_contract_daily' },
    { key: 'personal_info_consent', sheet: 'TPL_personal_info_consent', configKey: 'personal_info_consent' },
    { key: 'bank_account', sheet: 'TPL_bank_account', configKey: 'bank_account' },
    { key: 'health_certificate', sheet: 'TPL_health_certificate', configKey: 'health_certificate' },
    { key: 'criminal_check_consent', sheet: 'TPL_criminal_check_consent', configKey: 'criminal_check_consent' },
    { key: 'emergency_contact', sheet: 'TPL_emergency_contact', configKey: 'emergency_contact' },
    { key: 'data_security_pledge', sheet: 'TPL_data_security_pledge', configKey: 'data_security_pledge' },
  ]

  const outputDir = path.join(__dirname, 'calibration-output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const configPath = path.join(ROOT, 'config', 'signature-positions.json')
  const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  const detected = {}

  for (const doc of documents) {
    console.log(`--- ${doc.key} ---`)
    try {
      // Add contract-specific variables for labor contracts
      const vars = { ...baseVars }
      if (doc.key.startsWith('labor_contract')) {
        // Add placeholder contract vars to avoid {{xxx}} showing in PDF
        vars.salary_basic = vars.salary_basic || '0'
        vars.salary_OT = vars.salary_OT || '0'
        vars.salary_fix = vars.salary_fix || '0'
        vars.salary_total = vars.salary_total || '0'
        vars.work_hours = vars.work_hours || '주간'
        vars.intern_date_yy = vars.intern_date_yy || String(today.getFullYear())
        vars.intern_date_mm = vars.intern_date_mm || '01'
        vars.intern_date_dd = vars.intern_date_dd || '01'
      }

      const pdf = await generatePdfWithMarker(doc.sheet, vars)

      // Save raw PDF for inspection
      fs.writeFileSync(path.join(outputDir, `detect_${doc.key}.pdf`), pdf)

      const positions = await findMarkerInPdf(pdf, SIG_MARKER)

      if (positions.length === 0) {
        console.log(`  No "${SIG_MARKER}" found in PDF`)
      } else {
        for (const pos of positions) {
          console.log(`  Found: page=${pos.page}, x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, textW=${pos.width.toFixed(1)}, textH=${pos.height.toFixed(1)}`)
          console.log(`         pageSize: ${pos.pageWidth.toFixed(0)}x${pos.pageHeight.toFixed(0)}`)

          // Calculate signature position: center the signature image on the marker text
          const sigWidth = 160
          const sigHeight = 50
          // x: start at text x position
          // y: pdf-lib uses bottom-left origin, pdfjs y is already from bottom
          // Position signature centered vertically on the text
          const sigX = Math.round(pos.x)
          const sigY = Math.round(pos.y - sigHeight / 2 + (pos.height || 10) / 2)

          detected[doc.configKey] = {
            page: pos.page,
            x: sigX,
            y: sigY,
            width: sigWidth,
            height: sigHeight,
          }
        }
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`)
    }
    console.log()
  }

  // Also set labor_contract fallback = labor_contract_monthly
  if (detected.labor_contract_monthly) {
    detected.labor_contract = { ...detected.labor_contract_monthly }
  }

  console.log('\n=== Detected Positions ===')
  console.log(JSON.stringify(detected, null, 2))

  // Merge into existing config (preserve sheets_row, _note, _comment)
  const merged = { ...existingConfig }
  for (const [key, pos] of Object.entries(detected)) {
    merged[key] = {
      ...merged[key],  // preserve existing fields like sheets_row, _note
      page: pos.page,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
    }
  }

  // Save updated config
  const configBackup = path.join(outputDir, 'signature-positions.backup.json')
  fs.writeFileSync(configBackup, JSON.stringify(existingConfig, null, 2))
  console.log(`\nBackup saved: ${configBackup}`)

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n')
  console.log(`Updated: ${configPath}`)

  console.log('\nDone! Review the detected positions and run calibrate-sheets-pdf.mjs to verify.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
