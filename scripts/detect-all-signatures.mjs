/**
 * Detect ALL {{signature}} positions in Sheets-generated PDFs.
 * Stores multiple positions per document as arrays.
 *
 * Usage: node scripts/detect-all-signatures.mjs
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
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID
const CLIENT_ID = process.env.GMAIL_CLIENT_ID
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const REFRESH_TOKEN = process.env.GMAIL_CLIENT_REFRESH_TOKEN
const SHEET_EMPLOYEE_MASTER = process.env.SHEET_EMPLOYEE_MASTER || 'EMPLOYEE_MASTER'

const SIG_MARKER = 'XSIGX'

function getAuth() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  auth.setCredentials({ refresh_token: REFRESH_TOKEN })
  return auth
}
function getSheets() { return google.sheets({ version: 'v4', auth: getAuth() }) }

async function getSheetGid(name) {
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties',
  })
  const s = (meta.data.sheets ?? []).find(s => s.properties?.title === name)
  if (s?.properties?.sheetId == null) throw new Error(`Sheet not found: ${name}`)
  return s.properties.sheetId
}

async function exportPdf(gid, range = null) {
  const { token } = await getAuth().getAccessToken()
  // Match production export parameters (lib/sheets/template.ts RANGE_PAGE_CONFIG)
  const params = new URLSearchParams({
    format: 'pdf', gid: String(gid), size: 'A4', portrait: 'true',
    scale: '4', gridlines: 'false', printtitle: 'false', sheetnames: 'false',
    fzr: 'false', top_margin: '0.15', bottom_margin: '0.15',
    left_margin: '0.15', right_margin: '0.15',
  })
  if (range) {
    params.set('ir', 'false')
    params.set('ic', 'false')
    params.set('r1', String(range.r1))
    params.set('r2', String(range.r2))
    params.set('c1', String(range.c1 ?? 0))
    params.set('c2', String(range.c2 ?? 20))
  }
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Export ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function getFirstEmployee() {
  const result = await getSheets().spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${SHEET_EMPLOYEE_MASTER}!A:Z`,
  })
  const rows = result.data.values ?? []
  const headers = rows[0]; const emp = {}
  headers.forEach((h, i) => { emp[h] = rows[1]?.[i] || '' })
  return emp
}

async function generateWithMarker(sheetName, vars) {
  const sheets = getSheets()
  const workName = `WORK_sig_${Date.now()}`
  const tplGid = await getSheetGid(sheetName)

  const copy = await sheets.spreadsheets.sheets.copyTo({
    spreadsheetId: SPREADSHEET_ID, sheetId: tplGid,
    requestBody: { destinationSpreadsheetId: SPREADSHEET_ID },
  })
  const copiedId = copy.data.sheetId

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ updateSheetProperties: {
      properties: { sheetId: copiedId, title: workName }, fields: 'title',
    }}]},
  })

  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${workName}!A:Z`,
  })

  const filled = (read.data.values ?? []).map(row => row.map(cell => {
    let r = cell
    for (const [k, v] of Object.entries(vars)) r = r.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    return r
  }))

  if (filled.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `${workName}!A1`,
      valueInputOption: 'USER_ENTERED', requestBody: { values: filled },
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

async function findAllMarkers(pdfBuf, marker) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuf) }).promise
  const results = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const item of tc.items) {
      if (!item.str?.includes(marker)) continue
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== Detect ALL {{signature}} positions ===\n')
  const emp = await getFirstEmployee()
  console.log(`Employee: ${emp.name}, pay_sec: ${emp.pay_sec || 'monthly'}\n`)

  const today = new Date()
  const pad = n => String(n).padStart(2, '0')
  const baseVars = {
    employee_name: emp.name || '', name: emp.name || '',
    department: emp.department || '', position: emp.position || '',
    hire_date: emp.hire_date || '', adrress: emp.address || '',
    birthday: emp.birthday || '',
    date_yy: String(today.getFullYear()), date_mm: pad(today.getMonth() + 1),
    date_dd: pad(today.getDate()), signature: SIG_MARKER,
    salary_basic: '0', salary_OT: '0', salary_fix: '0', salary_total: '0',
    work_hours: '주간',
    hire_date_yy: '', hire_date_mm: '', hire_date_dd: '',
    intern_date_yy: '', intern_date_mm: '', intern_date_dd: '',
  }
  try {
    const p = (emp.hire_date || '').replace(/[^0-9.]/g, '').split('.')
    baseVars.hire_date_yy = p[0] || String(today.getFullYear())
    baseVars.hire_date_mm = pad(parseInt(p[1] || '1', 10))
    baseVars.hire_date_dd = pad(parseInt(p[2] || '1', 10))
  } catch {}

  const docs = [
    { key: 'labor_contract_monthly', sheet: 'TPL_labor_contract_monthly' },
    { key: 'labor_contract_daily', sheet: 'TPL_labor_contract_daily' },
    { key: 'personal_info_consent', sheet: 'TPL_personal_info_consent' },
    { key: 'bank_account', sheet: 'TPL_bank_account' },
    { key: 'health_certificate', sheet: 'TPL_health_certificate' },
    { key: 'criminal_check_consent', sheet: 'TPL_criminal_check_consent' },
    { key: 'emergency_contact', sheet: 'TPL_emergency_contact' },
    { key: 'data_security_pledge', sheet: 'TPL_data_security_pledge' },
  ]

  const outputDir = path.join(__dirname, 'calibration-output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const configPath = path.join(ROOT, 'config', 'signature-positions.json')
  const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  // Backup
  fs.writeFileSync(path.join(outputDir, 'signature-positions.backup.json'), JSON.stringify(existing, null, 2))

  const allDetected = {}

  for (const doc of docs) {
    console.log(`--- ${doc.key} ---`)
    try {
      const pdf = await generateWithMarker(doc.sheet, baseVars)
      fs.writeFileSync(path.join(outputDir, `detect_${doc.key}.pdf`), pdf)

      const markers = await findAllMarkers(pdf, SIG_MARKER)

      if (markers.length === 0) {
        console.log('  No markers found')
      } else {
        const SCALE = 1.1 // 10% larger than text
        const positions = markers.map(m => {
          // Signature size = text size * 1.1
          const sigW = Math.round(m.textWidth * SCALE)
          const sigH = Math.round(m.textHeight * SCALE)
          // Center-align: signature center = text center
          const textCenterX = m.x + m.textWidth / 2
          const textCenterY = m.y + m.textHeight / 2
          const sigX = Math.round(textCenterX - sigW / 2)
          const sigY = Math.round(textCenterY - sigH / 2)
          console.log(`  text: page=${m.page}, x=${m.x.toFixed(1)}, y=${m.y.toFixed(1)}, w=${m.textWidth.toFixed(1)}, h=${m.textHeight.toFixed(1)}`)
          console.log(`    → sig: x=${sigX}, y=${sigY}, w=${sigW}, h=${sigH}`)
          return { page: m.page, x: sigX, y: sigY, width: sigW, height: sigH }
        })
        allDetected[doc.key] = positions.length === 1 ? positions[0] : positions
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`)
      if (err.message.includes('429')) {
        console.log('  Rate limited, waiting 30s...')
        await sleep(30000)
      }
    }
    // Small delay between API calls to avoid rate limiting
    await sleep(2000)
    console.log()
  }

  // labor_contract fallback = labor_contract_monthly
  if (allDetected.labor_contract_monthly) {
    allDetected.labor_contract = allDetected.labor_contract_monthly
  }

  console.log('\n=== Detected Positions ===')
  console.log(JSON.stringify(allDetected, null, 2))

  // Merge: preserve _comment, sheets_row, _note from existing config
  const merged = { _comment: existing._comment }
  const allKeys = ['labor_contract', 'labor_contract_monthly', 'labor_contract_daily',
    'personal_info_consent', 'bank_account', 'health_certificate',
    'criminal_check_consent', 'emergency_contact', 'data_security_pledge']

  for (const key of allKeys) {
    const det = allDetected[key]
    const old = existing[key]

    if (det) {
      if (Array.isArray(det)) {
        // For arrays, keep metadata from old config on the first entry level
        merged[key] = det.map(p => ({ ...p }))
        // Store sheets_row/_note as top-level metadata
        if (old?.sheets_row) merged[key]._meta = { sheets_row: old.sheets_row, _note: old._note }
      } else {
        merged[key] = {
          ...det,
          ...(old?.sheets_row != null ? { sheets_row: old.sheets_row } : {}),
          ...(old?._note ? { _note: old._note } : {}),
        }
      }
    } else {
      // Keep existing if no detection
      merged[key] = old
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n')
  console.log(`\nUpdated: ${configPath}`)
  console.log('Done!')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
