/**
 * Read all relevant sheet data from the HR Google Spreadsheet.
 * Prints EVERY row with column letters (A, B, C...) for exact cell layout.
 * Also fetches merge info and checkbox/boolean values.
 *
 * Usage: npx ts-node --project tsconfig.json scripts/read-sheets-data.ts
 */

import fs from 'fs'
import path from 'path'

// Load .env.local manually (same pattern as create-sheets-templates.ts)
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
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
}

import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? ''

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_CLIENT_REFRESH_TOKEN })
  return auth
}

/** Convert 0-based column index to letter (0=A, 1=B, ..., 25=Z, 26=AA) */
function colLetter(idx: number): string {
  let s = ''
  let n = idx
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

async function main() {
  if (!SPREADSHEET_ID) {
    console.error('Set GOOGLE_SPREADSHEET_ID environment variable')
    process.exit(1)
  }

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // 1. Get full spreadsheet metadata including merges
  console.log('='.repeat(100))
  console.log('FETCHING SPREADSHEET METADATA (tabs + merges + grid properties)')
  console.log('='.repeat(100))

  const fullMeta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties,sheets.merges',
  })

  const sheetsData = fullMeta.data.sheets ?? []
  const allTabs = sheetsData.map((s) => s.properties?.title ?? '')
  console.log(`\nFound ${allTabs.length} tabs:`)
  allTabs.forEach((t, i) => console.log(`  ${i + 1}. ${t}`))

  // Build merge map by sheet title
  const mergeMap: Record<string, any[]> = {}
  for (const s of sheetsData) {
    const title = s.properties?.title ?? ''
    if (s.merges && s.merges.length > 0) {
      mergeMap[title] = s.merges
    }
  }

  // 2. Determine which tabs to read
  const targetTabs = allTabs.filter(
    (name) =>
      name === 'EMPLOYEE_MASTER' ||
      name === 'EMPLOYEE_CONTRACT' ||
      name.startsWith('TPL_labor_contract')
  )

  console.log(`\nWill read ${targetTabs.length} tabs:`)
  targetTabs.forEach((t) => console.log(`  - ${t}`))

  // 3. Read data from each target tab (using FORMATTED_VALUE to see checkboxes etc.)
  for (const tabName of targetTabs) {
    console.log('\n' + '='.repeat(100))
    console.log(`SHEET: ${tabName}`)
    console.log('='.repeat(100))

    // Print merge info for this sheet
    const merges = mergeMap[tabName]
    if (merges && merges.length > 0) {
      console.log(`\n  MERGED CELL RANGES (${merges.length} merges):`)
      for (const m of merges) {
        const startCol = colLetter(m.startColumnIndex)
        const endCol = colLetter(m.endColumnIndex - 1)
        const startRow = m.startRowIndex + 1 // 1-based
        const endRow = m.endRowIndex // already 1-based for display (endRow is exclusive)
        console.log(
          `    ${startCol}${startRow}:${endCol}${endRow} (rows ${startRow}-${endRow}, cols ${startCol}-${endCol})`
        )
      }
    } else {
      console.log('\n  NO MERGED CELLS')
    }

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A1:Z200`,
        valueRenderOption: 'FORMATTED_VALUE',
      })

      const rows = res.data.values
      if (!rows || rows.length === 0) {
        console.log('  (empty sheet - no data)')
        continue
      }

      // Find max column count across all rows
      let maxCols = 0
      for (const row of rows) {
        if (row.length > maxCols) maxCols = row.length
      }

      console.log(`\n  Total rows: ${rows.length}, Max columns: ${maxCols} (A-${colLetter(maxCols - 1)})`)
      console.log('')

      // Print EVERY row with column letters
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 1

        // Check if entirely empty
        const isEmpty = !row || row.length === 0 || row.every((c: string) => c === '' || c === undefined || c === null)
        if (isEmpty) {
          console.log(`  ROW ${rowNum}: (empty)`)
          continue
        }

        console.log(`  ROW ${rowNum}:`)
        for (let j = 0; j < row.length; j++) {
          const val = row[j]
          if (val !== '' && val !== undefined && val !== null) {
            const cellRef = `${colLetter(j)}${rowNum}`
            console.log(`    ${cellRef.padEnd(6)} = ${JSON.stringify(val)}`)
          }
        }
      }
    } catch (err: any) {
      console.error(`  ERROR reading ${tabName}: ${err.message}`)
    }
  }

  console.log('\n' + '='.repeat(100))
  console.log('DONE')
  console.log('='.repeat(100))
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
