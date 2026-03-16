/**
 * Test: export the TEMPLATE sheet directly (not a WORK copy).
 * If this works, the issue is with copied sheets.
 */
import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'

const envPath = path.join(process.cwd(), '.env.local')
const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
for (const line of lines) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  const v = t.slice(eq + 1).trim()
  if (!process.env[k]) process.env[k] = v
}

const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
)
auth.setCredentials({ refresh_token: process.env.GMAIL_CLIENT_REFRESH_TOKEN })

const sheets = google.sheets({ version: 'v4', auth })
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

// Get all sheets
const meta = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties',
})

console.log('=== All sheets ===')
for (const s of meta.data.sheets) {
  const p = s.properties
  console.log(`  ${p.title} (gid: ${p.sheetId})`)
}

// Find TPL_holiday_extension
const tplSheet = meta.data.sheets.find(
  s => s.properties.title === 'TPL_holiday_extension'
)

if (!tplSheet) {
  console.error('TPL_holiday_extension not found!')
  process.exit(1)
}

const tplGid = tplSheet.properties.sheetId
console.log(`\nTPL_holiday_extension gid: ${tplGid}`)

// Try to export template directly
const { token } = await auth.getAccessToken()
const params = new URLSearchParams({
  format: 'pdf',
  gid: String(tplGid),
  size: 'A4',
  portrait: 'true',
  scale: '4',
  gridlines: 'false',
  printtitle: 'false',
  sheetnames: 'false',
  fzr: 'false',
  top_margin: '0.25',
  bottom_margin: '0.25',
  left_margin: '0.25',
  right_margin: '0.25',
})

const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params}`
console.log(`\nExporting template directly...`)

const res = await fetch(exportUrl, {
  headers: { Authorization: `Bearer ${token}` },
})

console.log(`Status: ${res.status}`)
if (res.ok) {
  const buf = await res.arrayBuffer()
  console.log(`✓ Template export OK (${buf.byteLength} bytes)`)
} else {
  const body = await res.text()
  console.log(`✗ Export failed: ${body.slice(0, 200)}`)
}

// Now copy the template, then try to export the copy
console.log('\n--- Testing WORK copy export ---')
const copyResult = await sheets.spreadsheets.sheets.copyTo({
  spreadsheetId,
  sheetId: tplGid,
  requestBody: { destinationSpreadsheetId: spreadsheetId },
})
const copiedGid = copyResult.data.sheetId
console.log(`Copied sheet gid: ${copiedGid}`)

// Try exporting immediately
const params2 = new URLSearchParams({
  format: 'pdf',
  gid: String(copiedGid),
  size: 'A4',
  portrait: 'true',
  scale: '4',
  gridlines: 'false',
  printtitle: 'false',
  sheetnames: 'false',
  fzr: 'false',
  top_margin: '0.25',
  bottom_margin: '0.25',
  left_margin: '0.25',
  right_margin: '0.25',
})

for (let attempt = 0; attempt < 6; attempt++) {
  const url2 = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params2}`
  const res2 = await fetch(url2, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const elapsed = `attempt ${attempt}`
  if (res2.ok) {
    const buf = await res2.arrayBuffer()
    console.log(`✓ ${elapsed}: Copy export OK (${buf.byteLength} bytes)`)
    break
  } else {
    console.log(`✗ ${elapsed}: ${res2.status} - waiting 3s...`)
    await new Promise(r => setTimeout(r, 3000))
  }
}

// Clean up: delete copied sheet
await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: [{ deleteSheet: { sheetId: copiedGid } }],
  },
})
console.log('Cleaned up copied sheet')
