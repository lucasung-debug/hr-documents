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

/** Detected checkbox cell with its resolved boolean value */
interface CheckboxCell {
  row: number
  col: number
  value: boolean
}

/**
 * Scan template data for all TRUE/FALSE cells (checkbox indicators from Sheets).
 * Returns their positions and clears them in the data for safe RAW write.
 */
function detectAndClearCheckboxCells(data: string[][]): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = []
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      if (data[r][c] === 'TRUE' || data[r][c] === 'FALSE') {
        positions.push({ row: r, col: c })
        data[r][c] = ''
      }
    }
  }
  return positions
}

/**
 * Resolve what boolean value each checkbox should have based on document type.
 *
 * Rules:
 * - personal_info_consent: ALL checkboxes → TRUE (전체 동의)
 * - holiday_extension row 7: B(col1)=TRUE(동의함), D(col3)=FALSE(미동의)
 * - labor_contract row 7: B(col1)=TRUE(정함없음), D(col3)=FALSE(정함있음)
 * - labor_contract row 18: based on work_hours variable
 * - All others: first column in pair → TRUE, second → FALSE
 */
function resolveCheckboxValues(
  positions: { row: number; col: number }[],
  documentKey: string,
  variables: Record<string, string>,
  data: string[][]
): CheckboxCell[] {
  // Group by row (horizontal pairs) and by column (vertical pairs)
  const rowGroups = new Map<number, { row: number; col: number }[]>()
  const colGroups = new Map<number, { row: number; col: number }[]>()
  for (const pos of positions) {
    const rg = rowGroups.get(pos.row) || []
    rg.push(pos)
    rowGroups.set(pos.row, rg)

    const cg = colGroups.get(pos.col) || []
    cg.push(pos)
    colGroups.set(pos.col, cg)
  }

  // labor_contract: 가로 쌍 중 "주간"/"2교대" 라벨이 있는 행 = 근무형태
  let workHoursPairRow: number | undefined
  if (documentKey === 'labor_contract') {
    const horizontalPairs = [...rowGroups.entries()]
      .filter(([, cells]) => cells.length >= 2)
      .sort(([rowA], [rowB]) => rowA - rowB)

    // 라벨 기반 감지: 같은 행에 "주간" 또는 "2교대" 텍스트가 있는 가로 쌍
    for (const [pairRow] of horizontalPairs) {
      const rowData = data[pairRow] || []
      const hasWorkLabel = rowData.some(cell =>
        cell.includes('주간') || cell.includes('2교대')
      )
      if (hasWorkLabel) {
        workHoursPairRow = pairRow
        break
      }
    }
    // 폴백: 라벨 없으면 기존 로직 (2번째 가로 쌍)
    if (workHoursPairRow === undefined) {
      workHoursPairRow = horizontalPairs[1]?.[0]
    }

    console.log('[checkbox] horizontalPairs:', horizontalPairs.map(([r]) => r))
    console.log('[checkbox] workHoursPairRow:', workHoursPairRow)
    console.log('[checkbox] work_hours value:', variables.work_hours)
  }

  return positions.map(({ row, col }) => {
    let value: boolean

    if (documentKey === 'labor_contract' && row === workHoursPairRow) {
      // 근무형태 — depends on work_hours
      const workHours = variables.work_hours || '주간'
      const is2shift = workHours === '2교대'
      const rowCells = rowGroups.get(row) || []
      const sorted = [...rowCells].sort((a, b) => a.col - b.col)
      value = col === sorted[0].col ? !is2shift : is2shift
    } else {
      const rowCells = rowGroups.get(row) || []
      if (rowCells.length >= 2) {
        // Horizontal pair (same row): left = 동의(TRUE), right = 미동의(FALSE)
        const sorted = [...rowCells].sort((a, b) => a.col - b.col)
        value = col === sorted[0].col
      } else {
        // Check for vertical pair (same column, different rows)
        const colCells = colGroups.get(col) || []
        if (colCells.length >= 2) {
          // Vertical pair: top row = 동의(TRUE), bottom row = 미동의(FALSE)
          const sorted = [...colCells].sort((a, b) => a.row - b.row)
          value = row === sorted[0].row
        } else {
          // Unpaired single checkbox: default TRUE
          value = true
        }
      }
    }

    return { row, col, value }
  })
}

/**
 * Build updateCells batchUpdate requests to set real boolean values.
 * This is the only way to write actual checkbox booleans (not text).
 */
function buildCheckboxRequests(
  cells: CheckboxCell[],
  sheetId: number
): object[] {
  return cells.map(({ row, col, value }) => ({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: row,
        endRowIndex: row + 1,
        startColumnIndex: col,
        endColumnIndex: col + 1,
      },
      rows: [{
        values: [{
          userEnteredValue: { boolValue: value },
        }],
      }],
      fields: 'userEnteredValue',
    },
  }))
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
 * 4. Auto-detect checkbox cells, set correct booleans via updateCells
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

  // Auto-detect checkbox cells, clear them for RAW write, then resolve values
  const checkboxPositions = detectAndClearCheckboxCells(filledData)
  const checkboxCells = resolveCheckboxValues(checkboxPositions, documentKey, variables, filledData)

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

  // Set all checkbox boolean values via updateCells (only way to write real booleans)
  if (checkboxCells.length > 0) {
    const requests = buildCheckboxRequests(checkboxCells, copiedSheetId)
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
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

      // Fatal errors: don't retry
      const isForbidden = errStatus === 403 || errMsg.includes('403')
      if (isForbidden) throw err

      // Retryable: 400/404 = sheet not yet recognized, 429 = rate limit
      const isRetryable = errStatus === 400 || errStatus === 404 || errStatus === 429 ||
        errMsg.includes('400') || errMsg.includes('404') || errMsg.includes('429')
      if (!isRetryable || attempt >= maxRetries - 1) throw err

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000
      console.warn(`[exportWithRetry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
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
