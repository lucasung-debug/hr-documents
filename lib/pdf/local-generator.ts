import fs from 'fs'
import path from 'path'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { DocumentKey } from '@/types/document'
import type { PaySection } from '@/types/employee'
import { createLogger } from '@/lib/logger'

const log = createLogger('[pdf/local-generator]')

// ---------- Types ----------

interface TextField {
  key: string
  page: number
  x: number
  y: number
  fontSize: number
}

interface CheckboxField {
  key: string
  page: number
  x: number
  y: number
  size: number
  conditionKey: string
  conditionValue: string
}

interface TemplatePositionConfig {
  fields: TextField[]
  checkboxes: CheckboxField[]
}

interface TextPositionsConfig {
  _comment?: string
  _fonts: { regular: string; bold: string }
  [templateKey: string]: TemplatePositionConfig | string | { regular: string; bold: string } | undefined
}

// ---------- Config & Font Cache ----------

let cachedConfig: TextPositionsConfig | null = null
let cachedFont: ArrayBuffer | null = null
let cachedBoldFont: ArrayBuffer | null = null

function getTextPositionsConfig(): TextPositionsConfig {
  if (cachedConfig && process.env.NODE_ENV === 'production') return cachedConfig
  const configPath = path.resolve(process.cwd(), 'config/text-positions.json')
  cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as TextPositionsConfig
  return cachedConfig
}

function getFontBytes(fontFile: string): ArrayBuffer {
  const fontPath = path.resolve(process.cwd(), fontFile)
  return fs.readFileSync(fontPath).buffer as ArrayBuffer
}

function getRegularFont(): ArrayBuffer {
  if (cachedFont && process.env.NODE_ENV === 'production') return cachedFont
  const config = getTextPositionsConfig()
  cachedFont = getFontBytes(config._fonts.regular)
  return cachedFont
}

function getBoldFont(): ArrayBuffer {
  if (cachedBoldFont && process.env.NODE_ENV === 'production') return cachedBoldFont
  const config = getTextPositionsConfig()
  cachedBoldFont = getFontBytes(config._fonts.bold)
  return cachedBoldFont
}

// ---------- Template Resolution ----------

/**
 * Resolve template PDF path and config key.
 * labor_contract uses pay_sec to pick monthly/daily variant.
 */
function resolveTemplate(
  documentKey: DocumentKey,
  paySec?: PaySection
): { templatePath: string; configKey: string } {
  if (documentKey === 'labor_contract') {
    const variant = paySec === 'daily' ? 'daily' : 'monthly'
    return {
      templatePath: path.resolve(process.cwd(), `assets/templates/labor_contract_${variant}.pdf`),
      configKey: `labor_contract_${variant}`,
    }
  }
  return {
    templatePath: path.resolve(process.cwd(), `assets/templates/${documentKey}.pdf`),
    configKey: documentKey,
  }
}

// ---------- Checkbox Drawing ----------

/** Draw a filled checkbox mark (✓) at the given position */
function drawCheckmark(
  page: ReturnType<PDFDocument['getPages']>[number],
  x: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  page.drawText('✓', {
    x,
    y,
    size: size + 2,
    font,
    color: rgb(0, 0, 0),
  })
}

// ---------- Main Generator ----------

/**
 * Generate a PDF by overlaying text and checkbox marks on a blank template PDF.
 * This replaces the Google Sheets-based generatePdfFromTemplate().
 *
 * @param documentKey - Document type
 * @param variables - Template variables (employee_name, salary_basic, etc.)
 * @param paySec - Pay section (monthly/daily) for labor_contract
 * @returns PDF as Buffer
 */
export async function generatePdfLocal(
  documentKey: DocumentKey,
  variables: Record<string, string>,
  paySec?: PaySection
): Promise<Buffer> {
  const { templatePath, configKey } = resolveTemplate(documentKey, paySec)
  const config = getTextPositionsConfig()
  const templateConfig = config[configKey] as TemplatePositionConfig | undefined

  if (!templateConfig) {
    throw new Error(`No text position config found for template: ${configKey}`)
  }

  // Verify template PDF exists
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Template PDF not found: ${templatePath}. ` +
      'Export blank templates from Google Sheets and place in assets/templates/.'
    )
  }

  const templateBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)
  pdfDoc.registerFontkit(fontkit)

  // Embed Korean font
  const regularFontBytes = getRegularFont()
  const font = await pdfDoc.embedFont(regularFontBytes, { subset: true })

  const pages = pdfDoc.getPages()

  // Draw text fields
  for (const field of templateConfig.fields) {
    const value = variables[field.key]
    if (!value) continue

    if (field.page >= pages.length) {
      log.warn({ configKey, field: field.key, page: field.page, totalPages: pages.length },
        'Text field references non-existent page')
      continue
    }

    pages[field.page].drawText(value, {
      x: field.x,
      y: field.y,
      size: field.fontSize,
      font,
      color: rgb(0, 0, 0),
    })
  }

  // Draw checkboxes
  for (const checkbox of templateConfig.checkboxes) {
    if (checkbox.page >= pages.length) {
      log.warn({ configKey, checkbox: checkbox.key, page: checkbox.page },
        'Checkbox references non-existent page')
      continue
    }

    // Evaluate condition
    let shouldCheck = false
    if (checkbox.conditionKey === '_always') {
      shouldCheck = true
    } else {
      const actualValue = variables[checkbox.conditionKey] || ''
      shouldCheck = actualValue === checkbox.conditionValue
    }

    if (shouldCheck) {
      drawCheckmark(pages[checkbox.page], checkbox.x, checkbox.y, checkbox.size, font)
    }
  }

  const pdfBytes = await pdfDoc.save()
  log.info({ configKey, fieldCount: templateConfig.fields.length, size: pdfBytes.length },
    'Local PDF generated')

  return Buffer.from(pdfBytes)
}
