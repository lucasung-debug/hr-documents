import { NextRequest, NextResponse } from 'next/server'
import { signCaptureSchema } from '@/lib/validators/input'
import { base64DataUrlToBuffer, sha256 } from '@/lib/crypto/hash'
import { writeSignature } from '@/lib/storage/temp-files'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

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

    return NextResponse.json({ success: true, signHash })
  } catch (err) {
    log.error({ err }, '서명 저장 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
