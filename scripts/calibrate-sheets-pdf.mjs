/**
 * Calibrate signature positions on ACTUAL Sheets-generated PDFs.
 *
 * Connects to Google Sheets, generates PDFs for ALL document types
 * (matching production pipeline: scale='4', margins=0.15),
 * then draws red calibration markers at configured signature positions.
 *
 * Usage: node scripts/calibrate-sheets-pdf.mjs
 * Output: scripts/calibration-output/sheets_<docKey>_raw.pdf
 *         scripts/calibration-output/sheets_<docKey>_calibrated.pdf
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb } from 'pdf-lib'
import { google } from 'googleapis'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Load .env.local manually
const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
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
  console.error('Missing required env vars. Check .env.local')
  process.exit(1)
}

const configPath = path.join(ROOT, 'config', 'signature-positions.json')
const sigConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const outputDir = path.join(__dirname, 'calibration-output')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

// --- Document types and template mappings ---

// All document types to calibrate
const DOCUMENT_TYPES = [
  'labor_contract',
  'personal_info_consent',
  'holiday_extension',
  'data_security_pledge',
  'compliance',
  'overtime_work',
]

// Template sheet name overrides (must match lib/sheets/template.ts)
const SHEET_NAME_OVERRIDES = {
  personal_info_consent: 'TPL_personal_informaion',
}

// Page breaks matching production (lib/sheets/template.ts PAGE_BREAK_ROWS)
const PAGE_BREAK_ROWS = {
  labor_contract_monthly: [57],
  labor_contract_daily: [51],
  compliance: [49],
  personal_info_consent: [30, 50],
}

// Production export config (must match lib/sheets/template.ts RANGE_PAGE_CONFIG)
const RANGE_PAGE_CONFIG = {
  scale: '4',
  top_margin: '0.15',
  bottom_margin: '0.15',
  left_margin: '0.15',
  right_margin: '0.15',
}

// --- Google API helpers ---

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
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  })
  const sheet = (meta.data.sheets ?? []).find(
    (s) => s.properties?.title === sheetName
  )
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Sheet not found: ${sheetName}`)
  }
  return sheet.properties.sheetId
}

async function exportPdf(gid, config = {}, range = null) {
  const auth = getAuth()
  const { token } = await auth.getAccessToken()
  if (!token) throw new Error('Failed to get access token')

  const cfg = { scale: '4', top_margin: '0.25', bottom_margin: '0.25', left_margin: '0.25', right_margin: '0.25', ...config }
  const params = new URLSearchParams({
    format: 'pdf', gid: String(gid), size: 'A4', portrait: 'true',
    scale: cfg.scale, gridlines: 'false', printtitle: 'false',
    sheetnames: 'false', fzr: 'false',
    top_margin: cfg.top_margin, bottom_margin: cfg.bottom_margin,
    left_margin: cfg.left_margin, right_margin: cfg.right_margin,
  })

  if (range) {
    params.set('ir', 'false')
    params.set('ic', 'false')
    params.set('r1', String(range.r1))
    params.set('r2', String(range.r2))
    params.set('c1', String(range.c1 ?? 0))
    params.set('c2', String(range.c2 ?? 20))
  }

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?${params.toString()}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    throw new Error(`PDF export failed: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

// --- Merge multiple page buffers (matching lib/pdf/page-merge.ts) ---

async function mergePdfPages(pageBuffers) {
  const merged = await PDFDocument.create()
  for (const buf of pageBuffers) {
    const doc = await PDFDocument.load(buf)
    const [page] = await merged.copyPages(doc, [0])
    merged.addPage(page)
  }
  return Buffer.from(await merged.save())
}

// --- Build page ranges from break rows ---

function buildPageRanges(breakRows) {
  const ranges = []
  let startRow = 0
  for (const breakRow of breakRows) {
    ranges.push({ r1: startRow, r2: breakRow })
    startRow = breakRow
  }
  ranges.push({ r1: startRow, r2: 200 })
  return ranges
}

// --- Employee lookup ---

async function getFirstEmployee() {
  const sheets = getSheetsClient()
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_EMPLOYEE_MASTER}!A:Z`,
  })
  const rows = result.data.values ?? []
  if (rows.length < 2) throw new Error('No employees found')

  const headers = rows[0]
  const firstRow = rows[1]
  const emp = {}
  headers.forEach((h, i) => { emp[h] = firstRow[i] || '' })
  return emp
}

// --- Generate PDF for any document type ---

async function generateDocumentPdf(documentKey, employee) {
  const paySec = employee.pay_sec || 'monthly'
  const suffix = paySec === 'daily' ? 'daily' : 'monthly'

  // Resolve template sheet name
  let templateSheetName
  if (SHEET_NAME_OVERRIDES[documentKey]) {
    templateSheetName = SHEET_NAME_OVERRIDES[documentKey]
  } else if (documentKey === 'labor_contract') {
    templateSheetName = `TPL_labor_contract_${suffix}`
  } else {
    templateSheetName = `TPL_${documentKey}`
  }

  const workSheetName = `WORK_cal_${documentKey}_${Date.now()}`
  const sheets = getSheetsClient()

  // Copy template sheet
  const templateGid = await getSheetGid(templateSheetName)
  const copyResult = await sheets.spreadsheets.sheets.copyTo({
    spreadsheetId: SPREADSHEET_ID,
    sheetId: templateGid,
    requestBody: { destinationSpreadsheetId: SPREADSHEET_ID },
  })
  const copiedSheetId = copyResult.data.sheetId

  // Rename
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: copiedSheetId, title: workSheetName },
          fields: 'title',
        },
      }],
    },
  })

  // Read and fill placeholders
  const readResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${workSheetName}!A:Z`,
  })
  const data = readResult.data.values ?? []

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const variables = {
    employee_name: employee.name || '',
    name: employee.name || '',
    department: employee.department || '',
    position: employee.position || '',
    hire_date: employee.hire_date || '',
    adrress: employee.address || '',
    address: employee.address || '',
    birthday: employee.birthday || '',
    phone: employee.phone || '',
    date_yy: String(today.getFullYear()),
    date_mm: pad(today.getMonth() + 1),
    date_dd: pad(today.getDate()),
    signature: '',
  }

  try {
    const parts = (employee.hire_date || '').replace(/[^0-9.]/g, '').split('.')
    variables.hire_date_yy = parts[0] || String(today.getFullYear())
    variables.hire_date_mm = pad(parseInt(parts[1] || '1', 10))
    variables.hire_date_dd = pad(parseInt(parts[2] || '1', 10))
  } catch { /* use defaults */ }

  const filledData = data.map((row) =>
    row.map((cell) => {
      let result = cell
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
      return result
    })
  )

  if (filledData.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${workSheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: filledData },
    })
  }

  // Wait for sheet to be ready
  await new Promise(r => setTimeout(r, 1000))

  // Export PDF using production-matching parameters
  const workGid = await getSheetGid(workSheetName)
  const templateKey = documentKey === 'labor_contract'
    ? `labor_contract_${suffix}` : documentKey
  const breakRows = PAGE_BREAK_ROWS[templateKey]

  let pdfBuffer
  if (breakRows) {
    // Multi-page: export each row range separately, then merge (matches production)
    const ranges = buildPageRanges(breakRows)
    const pageBuffers = []
    for (const range of ranges) {
      const buf = await exportPdf(workGid, RANGE_PAGE_CONFIG, range)
      pageBuffers.push(buf)
    }
    pdfBuffer = await mergePdfPages(pageBuffers)
  } else {
    // Single page with range-based export (matches production)
    pdfBuffer = await exportPdf(workGid, RANGE_PAGE_CONFIG, { r1: 0, r2: 200 })
  }

  // Cleanup
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ deleteSheet: { sheetId: copiedSheetId } }],
    },
  }).catch(() => {})

  return { pdfBuffer, configKey: templateKey }
}

// --- Draw calibration markers ---

function drawCalibrationMarker(page, pos, label) {
  page.drawRectangle({
    x: pos.x, y: pos.y, width: pos.width, height: pos.height,
    borderColor: rgb(1, 0, 0), borderWidth: 2,
    color: rgb(1, 0, 0), opacity: 0.15,
  })
  const cx = pos.x + pos.width / 2
  const cy = pos.y + pos.height / 2
  page.drawLine({ start: { x: cx - 20, y: cy }, end: { x: cx + 20, y: cy }, color: rgb(1, 0, 0), thickness: 1 })
  page.drawLine({ start: { x: cx, y: cy - 20 }, end: { x: cx, y: cy + 20 }, color: rgb(1, 0, 0), thickness: 1 })
  page.drawText(label, { x: pos.x, y: pos.y + pos.height + 5, size: 8, color: rgb(1, 0, 0) })
}

// --- Main ---

async function main() {
  console.log('=== Sheets-based Signature Calibration (All Documents) ===')
  console.log(`Export config: scale=${RANGE_PAGE_CONFIG.scale}, margins=${RANGE_PAGE_CONFIG.top_margin}\n`)

  const employee = await getFirstEmployee()
  console.log(`Using employee: ${employee.name} (${employee.employee_id})`)
  console.log(`Pay section: ${employee.pay_sec || 'monthly'}\n`)

  for (const documentKey of DOCUMENT_TYPES) {
    console.log(`--- ${documentKey} ---`)
    try {
      const { pdfBuffer, configKey } = await generateDocumentPdf(documentKey, employee)

      // Save raw PDF
      const rawPath = path.join(outputDir, `sheets_${configKey}_raw.pdf`)
      fs.writeFileSync(rawPath, pdfBuffer)
      console.log(`  Raw: ${rawPath}`)

      // Load and draw markers
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pages = pdfDoc.getPages()
      console.log(`  Pages: ${pages.length}`)
      pages.forEach((p, i) => {
        const { width, height } = p.getSize()
        console.log(`    Page ${i}: ${width.toFixed(1)} x ${height.toFixed(1)} pt`)
      })

      // Get signature positions for this document
      const positions = sigConfig[configKey] ?? sigConfig[documentKey]
      const posArr = Array.isArray(positions) ? positions : positions ? [positions] : []

      for (let i = 0; i < posArr.length; i++) {
        const pos = posArr[i]
        if (pos.page < pages.length) {
          drawCalibrationMarker(pages[pos.page], pos, `#${i + 1} (p${pos.page})`)
          console.log(`  Marker #${i + 1}: page=${pos.page}, x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height}`)
        } else {
          console.log(`  [WARN] #${i + 1}: page ${pos.page} does not exist!`)
        }
      }

      const outPath = path.join(outputDir, `sheets_${configKey}_calibrated.pdf`)
      fs.writeFileSync(outPath, await pdfDoc.save())
      console.log(`  Calibrated: ${outPath}\n`)
    } catch (err) {
      console.error(`  [ERROR] ${documentKey}: ${err.message}\n`)
    }
  }

  console.log('Done! Open calibrated PDFs to verify red markers are on signature lines.')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
