import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
)
auth.setCredentials({ refresh_token: process.env.GMAIL_CLIENT_REFRESH_TOKEN })

const sheets = google.sheets({ version: 'v4', auth })
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

// Step 1: List all sheet names
const meta = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: 'sheets.properties.title,sheets.properties.sheetId',
})

console.log('=== All sheet tabs ===')
for (const s of meta.data.sheets) {
  console.log(`  ${s.properties.title} (gid: ${s.properties.sheetId})`)
}

// Step 2: Find the personal_info_consent template (gid=1595699262 from user URL)
const targetSheet = meta.data.sheets.find(
  s => s.properties.sheetId === 1595699262
)

if (targetSheet) {
  console.log(`\n=== Reading: ${targetSheet.properties.title} ===`)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${targetSheet.properties.title}'!A:Z`,
  })
  console.log(JSON.stringify(res.data.values, null, 2))
} else {
  console.log('\nSheet with gid=1595699262 not found')
}
