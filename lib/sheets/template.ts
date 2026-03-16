import { getSheetsClient, SPREADSHEET_ID, withRetry } from './client'
import { exportSheetTabAsPdf, type PdfExportConfig, type PdfExportRange } from './drive'
import { mergePdfPages } from '@/lib/pdf/page-merge'
import type { DocumentKey } from '@/types/document'
import type { PaySection } from '@/types/employee'

// Template sheet tab names follow: TPL_{documentKey}
// Labor contract splits into TPL_labor_contract_monthly / _daily
const TEMPLATE_PREFIX = 'TPL_'

/**
 * Map documentKey to actual Google Sheets tab name when they differ.
 * The personal_info_consent sheet was created with a typo (informaion).
 */
const SHEET_NAME_OVERRIDES: Partial<Record<DocumentKey, string>> = {
  personal_info_consent: 'TPL_personal_informaion',
}

/**
 * Resolve the actual sheet tab name.
 * For labor_contract, uses pay_sec to pick monthly or daily template.
 */
export function getTemplateSheetName(
  documentKey: DocumentKey,
  paySec?: PaySection
): string {
  if (SHEET_NAME_OVERRIDES[documentKey]) {
    return SHEET_NAME_OVERRIDES[documentKey]!
  }
  if (documentKey === 'labor_contract') {
    const suffix = paySec === 'daily' ? 'daily' : 'monthly'
    return `${TEMPLATE_PREFIX}labor_contract_${suffix}`
  }
  return `${TEMPLATE_PREFIX}${documentKey}`
}

/**
 * Read all cell values from a template sheet tab.
 * Returns a 2D array of strings.
 */
export async function getTemplateSheet(
  documentKey: DocumentKey,
  paySec?: PaySection
): Promise<string[][]> {
  const sheets = getSheetsClient()
  const sheetName = getTemplateSheetName(documentKey, paySec)

  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A:Z`,
    })
  )

  return (response.data.values as string[][]) ?? []
}

/**
 * Clear checkbox cells so RAW write doesn't put "TRUE"/"FALSE" text.
 * Row 19 (0-indexed: 18) has checkboxes: B=col 1, D=col 3.
 * Actual boolean values are set separately via updateCells batchUpdate.
 */
function clearCheckboxCells(data: string[][]): string[][] {
  const row = 18 // 0-indexed row 19
  if (row >= data.length) return data
  if (data[row].length > 1) data[row][1] = ''
  if (data[row].length > 3) data[row][3] = ''
  return data
}

/**
 * Fill {{placeholder}} variables by copying the template sheet
 * (preserving all formatting, checkboxes, merged cells) and
 * updating only the cell values in the copy.
 *
 * Strategy:
 * 1. Copy TPL_ sheet via copyTo (preserves everything)
 * 2. Rename copied sheet to WORK_xxx
 * 3. Read values, replace {{placeholders}}, write back
 * 4. Apply work_hours checkbox for labor contracts
 * 5. Export WORK_ sheet as PDF
 * 6. Delete WORK_ sheet
 */
export async function fillTemplate(
  documentKey: DocumentKey,
  variables: Record<string, string>,
  paySec?: PaySection
): Promise<{ filledData: string[][]; workSheetName: string; copiedSheetId: number }> {
  const sheets = getSheetsClient()
  const spreadsheetId = SPREADSHEET_ID()
  const templateSheetName = getTemplateSheetName(documentKey, paySec)
  const sheetSuffix = documentKey === 'labor_contract'
    ? `labor_contract_${paySec ?? 'monthly'}`
    : documentKey
  const workSheetName = `WORK_${sheetSuffix}_${Date.now()}`

  // Step 1: Get template sheet ID
  const templateGid = await getSheetGid(templateSheetName)

  // Step 2: Copy the entire template sheet (preserves formatting, checkboxes, merges)
  const copyResult = await withRetry(() =>
    sheets.spreadsheets.sheets.copyTo({
      spreadsheetId,
      sheetId: templateGid,
      requestBody: { destinationSpreadsheetId: spreadsheetId },
    })
  )

  const copiedSheetId = copyResult.data.sheetId!

  // Step 3: Rename the copied sheet from "Copy of TPL_xxx" to WORK_xxx
  await withRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: copiedSheetId,
                title: workSheetName,
              },
              fields: 'title',
            },
          },
        ],
      },
    })
  )

  // Step 4: Read values from copied sheet, replace placeholders, write back
  const readResult = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${workSheetName}!A:Z`,
    })
  )

  const templateData = (readResult.data.values as string[][]) ?? []

  let filledData = templateData.map((row) =>
    row.map((cell) => {
      let result = cell
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
      return result
    })
  )

  // Clear checkbox cells before RAW write to avoid "TRUE"/"FALSE" text
  if (documentKey === 'labor_contract') {
    filledData = clearCheckboxCells(filledData)
  }

  // Write replaced values back with RAW to preserve phone number leading zeros
  if (filledData.length > 0) {
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${workSheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: filledData },
      })
    )
  }

  // Set checkbox boolean values via updateCells (only way to write real booleans)
  // Always set booleans for labor_contract — default to '주간' if work_hours is empty
  if (documentKey === 'labor_contract') {
    const workHours = variables.work_hours || '주간'
    const is2shift = workHours === '2교대'
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateCells: {
                range: {
                  sheetId: copiedSheetId,
                  startRowIndex: 18, // 0-indexed row 19
                  endRowIndex: 19,
                  startColumnIndex: 1, // column B
                  endColumnIndex: 2,
                },
                rows: [{
                  values: [{
                    userEnteredValue: { boolValue: !is2shift },
                  }],
                }],
                fields: 'userEnteredValue',
              },
            },
            {
              updateCells: {
                range: {
                  sheetId: copiedSheetId,
                  startRowIndex: 18,
                  endRowIndex: 19,
                  startColumnIndex: 3, // column D
                  endColumnIndex: 4,
                },
                rows: [{
                  values: [{
                    userEnteredValue: { boolValue: is2shift },
                  }],
                }],
                fields: 'userEnteredValue',
              },
            },
          ],
        },
      })
    )
  }

  return { filledData, workSheetName, copiedSheetId }
}

/**
 * Get the GID (sheet ID) of a named sheet tab.
 */
export async function getSheetGid(sheetName: string): Promise<number> {
  const sheets = getSheetsClient()
  const meta = await withRetry(() =>
    sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID(),
      fields: 'sheets.properties',
    })
  )

  const sheet = (meta.data.sheets ?? []).find(
    (s) => s.properties?.title === sheetName
  )

  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Sheet not found: ${sheetName}`)
  }

  return sheet.properties.sheetId
}

/**
 * Delete a sheet tab by name (used to clean up work sheets).
 */
export async function deleteSheet(sheetName: string): Promise<void> {
  const sheets = getSheetsClient()
  const gid = await getSheetGid(sheetName)

  await withRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID(),
      requestBody: {
        requests: [{ deleteSheet: { sheetId: gid } }],
      },
    })
  )
}

/**
 * Page break rows per template (1-indexed, inclusive end).
 * Each number = last row of that page.
 * Example: [57] → Page1: rows 1-57, Page2: rows 58+
 *
 * Documents not listed here = single page, exported as-is.
 */
const PAGE_BREAK_ROWS: Record<string, number[]> = {
  labor_contract_monthly: [57],    // P1: 1-57, P2: 58+
  labor_contract_daily: [51],      // P1: 1-51, P2: 52+
  compliance: [49],                // P1: 1-49, P2: 50+
  personal_info_consent: [30, 50], // P1: 1-30, P2: 31-50, P3: 51+
}

/** Config used for each page in range-based multi-page export */
const RANGE_PAGE_CONFIG: Partial<PdfExportConfig> = {
  scale: '4',
  top_margin: '0.15',
  bottom_margin: '0.15',
  left_margin: '0.15',
  right_margin: '0.15',
}

/**
 * Convert page break rows into 0-indexed PdfExportRange array.
 * breakRows [57] → [{r1:0, r2:57}, {r1:57, r2:200}]
 */
function buildPageRanges(breakRows: number[]): PdfExportRange[] {
  const ranges: PdfExportRange[] = []
  let startRow = 0

  for (const breakRow of breakRows) {
    ranges.push({ r1: startRow, r2: breakRow })
    startRow = breakRow
  }
  // Last page: remaining rows (200 as safe upper bound)
  ranges.push({ r1: startRow, r2: 200 })

  return ranges
}

/**
 * Export with retry to handle race condition where Google's web export
 * endpoint hasn't yet recognized a newly created sheet tab.
 * Retries up to maxRetries times with increasing delay (1s, 2s, 3s).
 */
async function exportWithRetry(
  spreadsheetId: string,
  gid: number,
  config?: Partial<PdfExportConfig>,
  range?: PdfExportRange,
  maxRetries = 3
): Promise<Buffer> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await exportSheetTabAsPdf(spreadsheetId, gid, config, range)
    } catch (err: unknown) {
      const errMsg = String((err as { message?: unknown })?.message ?? err)
      const errStatus = (err as { status?: number; code?: number })?.status ??
        (err as { status?: number; code?: number })?.code
      const isNotFound = errStatus === 400 || errStatus === 404 ||
        errMsg.includes('400') || errMsg.includes('404')
      if (!isNotFound || attempt >= maxRetries - 1) throw err
      console.warn(`[exportWithRetry] Attempt ${attempt + 1} failed, retrying in ${(attempt + 1)}s...`)
      await new Promise(r => setTimeout(r, (attempt + 1) * 1000))
    }
  }
  throw new Error('exportWithRetry: unreachable')
}

/**
 * Full pipeline: fill template → export as PDF → cleanup work sheet.
 * Returns PDF as Buffer.
 */
export async function generatePdfFromTemplate(
  documentKey: DocumentKey,
  variables: Record<string, string>,
  paySec?: PaySection
): Promise<Buffer> {
  const { workSheetName, copiedSheetId } = await fillTemplate(documentKey, variables, paySec)

  try {
    const spreadsheetId = SPREADSHEET_ID()
    const gid = copiedSheetId

    // Determine template key for page break lookup
    const templateKey = documentKey === 'labor_contract'
      ? `labor_contract_${paySec ?? 'monthly'}`
      : documentKey

    const breakRows = PAGE_BREAK_ROWS[templateKey]

    if (breakRows) {
      // Multi-page: export each row range separately, then merge
      const ranges = buildPageRanges(breakRows)
      const pageBuffers = await Promise.all(
        ranges.map((range) =>
          exportWithRetry(spreadsheetId, gid, RANGE_PAGE_CONFIG, range)
        )
      )
      return mergePdfPages(pageBuffers)
    }

    // Single page: use range-based export for consistency.
    // Google's export endpoint handles range-based requests more reliably
    // for newly created (copied) sheets.
    const fullPageRange: PdfExportRange = { r1: 0, r2: 200 }
    return exportWithRetry(spreadsheetId, gid, RANGE_PAGE_CONFIG, fullPageRange)
  } finally {
    // Always clean up work sheet
    await deleteSheet(workSheetName).catch(() => {})
  }
}
