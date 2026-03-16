import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'

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

const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: 'EMPLOYEE_MASTER!A1:L5',
})
console.log(JSON.stringify(res.data.values, null, 2))
