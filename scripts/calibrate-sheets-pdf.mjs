/**
 * Calibrate signature positions on ACTUAL Sheets-generated PDFs.
 *
 * Connects to Google Sheets, generates the labor contract PDF (same pipeline
 * as the app), then draws red calibration markers at configured signature positions.
 *
 * Usage: node scripts/calibrate-sheets-pdf.mjs [employeeId]
 * Output: scripts/calibration-output/sheets_<docKey>_calibrated.pdf
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb } from 'pdf-lib'
import { google } from 'googleapis'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Load .env.local manually (no dotenv dependency)
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

// Load signature positions config
const configPath = path.join(ROOT, 'config', 'signature-positions.json')
const sigConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const outputDir = path.join(__dirname, 'calibration-output')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

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

async function exportSheetTabAsPdf(gid) {
  const auth = getAuth()
  const { token } = await auth.getAccessToken()
  if (!token) throw new Error('Failed to get access token')

  const params = new URLSearchParams({
    format: 'pdf',
    gid: String(gid),
    size: 'A4',
    portrait: 'true',
    scale: '2',
    gridlines: 'false',
    printtitle: 'false',
    sheetnames: 'false',
    fzr: 'false',
    top_margin: '0.25',
    bottom_margin: '0.25',
    left_margin: '0.25',
    right_margin: '0.25',
  })

  const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?${params.toString()}`
  const response = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`PDF export failed: ${response.status} ${response.statusText}`)
  }

  return Buffer.from(await response.arrayBuffer())
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

// --- Template fill & PDF generation ---

async function generateLaborContractPdf(employee) {
  const paySec = employee.pay_sec || 'monthly'
  const suffix = paySec === 'daily' ? 'daily' : 'monthly'
  const templateSheetName = `TPL_labor_contract_${suffix}`
  const workSheetName = `WORK_calibration_${Date.now()}`

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

  // Read values, fill placeholders
  const readResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${workSheetName}!A:Z`,
  })
  const data = (readResult.data.values ?? [])

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const variables = {
    employee_name: employee.name || '',
    name: employee.name || '',
    department: employee.department || '',
    position: employee.position || '',
    hire_date: employee.hire_date || '',
    adrress: employee.address || '',
    birthday: employee.birthday || '',
    date_yy: String(today.getFullYear()),
    date_mm: pad(today.getMonth() + 1),
    date_dd: pad(today.getDate()),
    signature: '',  // No text signature — only image
  }

  // Try to parse hire_date
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

  // Write back
  if (filledData.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${workSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: filledData },
    })
  }

  // Export PDF
  const workGid = await getSheetGid(workSheetName)
  const pdfBuffer = await exportSheetTabAsPdf(workGid)

  // Cleanup work sheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ deleteSheet: { sheetId: copiedSheetId } }],
    },
  }).catch(() => {})

  return { pdfBuffer, paySec: suffix }
}

// --- Draw calibration markers ---

function drawCalibrationMarker(page, pos, label) {
  // Red rectangle with transparency
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

  // Crosshair
  const cx = pos.x + pos.width / 2
  const cy = pos.y + pos.height / 2
  page.drawLine({
    start: { x: cx - 20, y: cy },
    end: { x: cx + 20, y: cy },
    color: rgb(1, 0, 0),
    thickness: 1,
  })
  page.drawLine({
    start: { x: cx, y: cy - 20 },
    end: { x: cx, y: cy + 20 },
    color: rgb(1, 0, 0),
    thickness: 1,
  })

  // Label
  page.drawText(label, {
    x: pos.x,
    y: pos.y + pos.height + 5,
    size: 8,
    color: rgb(1, 0, 0),
  })
}

// --- Main ---

async function main() {
  console.log('=== Sheets-based Signature Calibration ===\n')

  // Get first employee for template filling
  const employee = await getFirstEmployee()
  console.log(`Using employee: ${employee.name} (${employee.employee_id})`)
  console.log(`Pay section: ${employee.pay_sec || 'monthly'}\n`)

  // Generate labor contract PDF from Sheets
  console.log('Generating labor contract PDF from Sheets...')
  const { pdfBuffer, paySec } = await generateLaborContractPdf(employee)

  // Also save the raw (unmarked) PDF for reference
  const rawPath = path.join(outputDir, `sheets_labor_contract_${paySec}_raw.pdf`)
  fs.writeFileSync(rawPath, pdfBuffer)
  console.log(`Raw PDF saved: ${rawPath}`)

  // Load and mark with calibration markers
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const pages = pdfDoc.getPages()
  console.log(`PDF has ${pages.length} page(s)`)

  // Print page sizes
  pages.forEach((p, i) => {
    const { width, height } = p.getSize()
    console.log(`  Page ${i}: ${width.toFixed(1)} x ${height.toFixed(1)} pt`)
  })

  // Try all labor contract config keys
  const configKeys = [`labor_contract_${paySec}`, 'labor_contract']
  for (const key of configKeys) {
    const pos = sigConfig[key]
    if (!pos) continue

    if (pos.page < pages.length) {
      drawCalibrationMarker(pages[pos.page], pos, `${key} (p${pos.page})`)
      console.log(`\nMarker drawn for "${key}": page=${pos.page}, x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height}`)
    } else {
      console.log(`\n[WARN] "${key}": page ${pos.page} does not exist!`)
    }
  }

  // Save calibrated PDF
  const outPath = path.join(outputDir, `sheets_labor_contract_${paySec}_calibrated.pdf`)
  const savedBytes = await pdfDoc.save()
  fs.writeFileSync(outPath, savedBytes)
  console.log(`\nCalibrated PDF saved: ${outPath}`)
  console.log('\nDone! Open the PDF to check if the red marker is on the signature line.')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
