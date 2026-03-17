import { NextRequest, NextResponse } from 'next/server'
import { docConsentSchema } from '@/lib/validators/input'
import { readSignature, ensureSessionDir, getPdfPath } from '@/lib/storage/temp-files'
import { generateSignedPdf } from '@/lib/pdf/generator'
import { generatePdfFromTemplate } from '@/lib/sheets/template'
import { getContractConditions } from '@/lib/sheets/contract'
import { buildBaseVariables, buildContractVariables } from '@/lib/sheets/template-variables'
import { getEmployeeById } from '@/lib/sheets/employee'
import {
  findDocStatusByEmployeeId,
  updateDocumentStatus,
} from '@/lib/sheets/document-status'
import { DOC_STATUS } from '@/types/document'
import { getSignaturePositionConfig } from '@/lib/pdf/signature-config'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/consent]')

const USE_SHEETS = process.env.USE_SHEETS_TEMPLATES !== 'false'

export async function POST(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = docConsentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { documentKey } = parsed.data

    // personal_info_consent: signature is optional (handled before signature step)
    const isPersonalInfoConsent = documentKey === 'personal_info_consent'
    let signatureBuffer: Buffer | null = null

    if (!isPersonalInfoConsent) {
      signatureBuffer = readSignature(employeeId)
    } else {
      // Try to read signature if available, but don't fail if not
      try {
        signatureBuffer = readSignature(employeeId)
      } catch {
        // Signature not yet available for personal_info_consent
        signatureBuffer = null
      }
    }

    if (USE_SHEETS) {
      // --- Sheets-based pipeline ---
      // Parallel fetch: employee info + contract conditions (if labor_contract)
      const [empResult, conditions] = await Promise.all([
        getEmployeeById(employeeId),
        documentKey === 'labor_contract'
          ? getContractConditions(employeeId)
          : Promise.resolve(null),
      ])

      if (!empResult) {
        return NextResponse.json(
          { error: '직원 정보를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      const { employee } = empResult
      const variables = buildBaseVariables(employee)

      if (documentKey === 'labor_contract' && conditions) {
        Object.assign(variables, buildContractVariables(conditions))
      }

      // Generate PDF from Sheets template (pay_sec selects monthly/daily)
      const pdfBuffer = await generatePdfFromTemplate(
        documentKey,
        variables,
        employee.pay_sec
      )

      // Embed signature image into the PDF (if signature is available)
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pages = pdfDoc.getPages()

      if (signatureBuffer && Buffer.isBuffer(signatureBuffer)) {
        const config = getSignaturePositionConfig()
        const posKey = documentKey === 'labor_contract'
          ? `labor_contract_${employee.pay_sec}` as const
          : documentKey
        const position = config[posKey] ?? config[documentKey]

        // Support single position or array of positions
        const positions = Array.isArray(position) ? position : position ? [position] : []
        if (positions.length > 0) {
          const sigImage = await pdfDoc.embedPng(signatureBuffer)
          for (const pos of positions) {
            if (pos.page < pages.length) {
              const page = pages[pos.page]
              const { width: pageW, height: pageH } = page.getSize()
              if (pos.x + pos.width > pageW || pos.y + pos.height > pageH) {
                log.warn({ documentKey, posKey, page: pos.page, pageW, pageH, pos },
                  'Signature position may extend beyond page bounds')
              }
              page.drawImage(sigImage, {
                x: pos.x,
                y: pos.y,
                width: pos.width,
                height: pos.height,
              })
            } else {
              log.warn({ documentKey, posKey, page: pos.page, totalPages: pages.length },
                'Signature position references non-existent page')
            }
          }
        } else {
          log.warn({ documentKey, posKey }, 'No signature positions configured')
        }
      }

      const signedPdfBytes = await pdfDoc.save()

      // Save to temp storage
      ensureSessionDir(employeeId)
      const outputPath = getPdfPath(employeeId, documentKey)
      fs.writeFileSync(outputPath, signedPdfBytes)
    } else {
      // --- Legacy PDF template pipeline ---
      if (signatureBuffer && Buffer.isBuffer(signatureBuffer)) {
        const result = await generateSignedPdf(employeeId, documentKey, signatureBuffer)
        if (!result.success) {
          return NextResponse.json(
            { error: result.error ?? 'PDF 생성에 실패했습니다.' },
            { status: 500 }
          )
        }
      }
      // If no signature (personal_info_consent), skip PDF generation for legacy pipeline
    }

    // Update Google Sheets status
    const statusResult = await findDocStatusByEmployeeId(employeeId)
    if (statusResult) {
      await updateDocumentStatus(statusResult.rowIndex, documentKey, DOC_STATUS.SIGNED)
    }

    return NextResponse.json({
      success: true,
      status: DOC_STATUS.SIGNED,
    })
  } catch (err) {
    log.error({ err }, '서류 동의 처리 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
