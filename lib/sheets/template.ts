import { getSheetsClient, SPREADSHEET_ID, withRetry } from './client'
import { exportSheetTabAsPdf } from './drive'
import type { DocumentKey } from '@/types/document'
import type { PaySection } from '@/types/employee'

// Template sheet tab names follow: TPL_{documentKey}
// Labor contract splits into TPL_labor_contract_monthly / _daily
const TEMPLATE_PREFIX = 'TPL_'

/**
 * Resolve the actual sheet tab name.
 * For labor_contract, uses pay_sec to pick monthly or daily template.
 */
export function getTemplateSheetName(
  documentKey: DocumentKey,
  paySec?: PaySection
): string {
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
 * Apply work_hours checkbox logic.
 * Row 19 (0-indexed: 18) has checkboxes: B=주간 checkbox, D=2교대 checkbox.
 * Sets the matching one to TRUE, the other to FALSE.
 */
function applyWorkHoursCheckbox(
  data: string[][],
  workHours: string
): string[][] {
  const row = 18 // 0-indexed row 19
  if (row >= data.length) return data

  const is2shift = workHours === '2교대'
  // B column = index 1, D column = index 3
  // Use TRUE/FALSE for Google Sheets checkbox data validation
  if (data[row].length > 1) data[row][1] = is2shift ? 'FALSE' : 'TRUE'
  if (data[row].length > 3) data[row][3] = is2shift ? 'TRUE' : 'FALSE'

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
): Promise<{ filledData: string[][]; workSheetName: string }> {
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

  // Apply work_hours checkbox for labor contracts
  if (documentKey === 'labor_contract' && variables.work_hours) {
    filledData = applyWorkHoursCheckbox(filledData, variables.work_hours)
  }

  // Write replaced values back (preserves formatting, only updates values)
  if (filledData.length > 0) {
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${workSheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: filledData },
      })
    )
  }

  return { filledData, workSheetName }
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
 * Full pipeline: fill template → export as PDF → cleanup work sheet.
 * Returns PDF as Buffer.
 */
export async function generatePdfFromTemplate(
  documentKey: DocumentKey,
  variables: Record<string, string>,
  paySec?: PaySection
): Promise<Buffer> {
  const { workSheetName } = await fillTemplate(documentKey, variables, paySec)

  try {
    const gid = await getSheetGid(workSheetName)
    const pdfBuffer = await exportSheetTabAsPdf(SPREADSHEET_ID(), gid)
    return pdfBuffer
  } finally {
    // Always clean up work sheet
    await deleteSheet(workSheetName).catch(() => {})
  }
}
