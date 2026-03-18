import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import { signCaptureSchema } from '@/lib/validators/input'
import { base64DataUrlToBuffer, sha256 } from '@/lib/crypto/hash'
import { writeSignature, ensureSessionDir, getPdfPath } from '@/lib/storage/temp-files'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'
import { getEmployeeById } from '@/lib/sheets/employee'
import { buildBaseVariables } from '@/lib/sheets/template-variables'
import { generatePdfFromTemplate } from '@/lib/sheets/template'
import { getSignaturePositionConfig } from '@/lib/pdf/signature-config'

const log = createLogger('[sign/capture]')

const MIN_WIDTH_PX = 300

export async function POST(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = signCaptureSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { signatureBase64 } = parsed.data
    const buffer = base64DataUrlToBuffer(signatureBase64)

    // Validate minimum size (heuristic: PNG with 300px width is at least ~5KB)
    if (buffer.length < 1000) {
      return NextResponse.json(
        { error: '서명이 너무 작습니다. 다시 서명해주세요.' },
        { status: 400 }
      )
    }

    // Validate PNG header magic bytes
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    if (!buffer.subarray(0, 4).equals(PNG_MAGIC)) {
      return NextResponse.json(
        { error: '유효하지 않은 이미지 형식입니다.' },
        { status: 400 }
      )
    }

    // Read PNG width from header (bytes 16-19 in IHDR chunk)
    // PNG structure: 8-byte signature + 4-byte length + 4-byte "IHDR" + 4-byte width + ...
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16)
      if (width < MIN_WIDTH_PX) {
        return NextResponse.json(
          { error: `서명 해상도가 너무 낮습니다. (최소 ${MIN_WIDTH_PX}px)` },
          { status: 400 }
        )
      }
    }

    const signHash = sha256(buffer)
    writeSignature(employeeId, buffer)

    // 서명 저장 후 personal_info_consent PDF를 서명 포함하여 비동기 재생성 (응답 차단하지 않음)
    const sigBuffer = Buffer.from(buffer)
    void (async () => {
      try {
        const empResult = await getEmployeeById(employeeId)
        if (empResult) {
          const { employee } = empResult
          const variables = buildBaseVariables(employee)
          const pdfBuffer = await generatePdfFromTemplate('personal_info_consent', variables)
          const pdfDoc = await PDFDocument.load(pdfBuffer)
          const pages = pdfDoc.getPages()
          const config = getSignaturePositionConfig()
          const position = config['personal_info_consent']
          const positions = Array.isArray(position) ? position : position ? [position] : []
          if (positions.length > 0) {
            const sigImage = await pdfDoc.embedPng(sigBuffer)
            for (const pos of positions) {
              if (pos.page < pages.length) {
                pages[pos.page].drawImage(sigImage, {
                  x: pos.x, y: pos.y, width: pos.width, height: pos.height
                })
              }
            }
          }
          const signedBytes = await pdfDoc.save()
          ensureSessionDir(employeeId)
          fs.writeFileSync(
            getPdfPath(employeeId, 'personal_info_consent'),
            Buffer.from(signedBytes)
          )
        }
      } catch (err) {
        log.warn({ err }, 'personal_info_consent 재생성 실패 (non-fatal)')
      }
    })()

    return NextResponse.json({ success: true, signHash })
  } catch (err) {
    log.error({ err }, '서명 저장 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
