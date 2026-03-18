/**
 * Unit tests for sign/capture route — personal_info_consent regeneration logic.
 */
import { PDFDocument } from 'pdf-lib'
import zlib from 'zlib'

// Mock all external dependencies
jest.mock('@/lib/sheets/employee')
jest.mock('@/lib/sheets/template-variables')
jest.mock('@/lib/pdf/generate-pdf')
jest.mock('@/lib/sheets/template')
jest.mock('@/lib/pdf/signature-config')
jest.mock('@/lib/storage/temp-files')
jest.mock('@/lib/crypto/hash')
jest.mock('fs')
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}))
jest.mock('@/lib/api', () => ({
  apiFromUnknown: jest.fn().mockReturnValue(
    new Response(JSON.stringify({ error: 'unknown' }), { status: 500 })
  ),
}))

import { getEmployeeById } from '@/lib/sheets/employee'
import { buildBaseVariables } from '@/lib/sheets/template-variables'
import { generatePdf } from '@/lib/pdf/generate-pdf'
import { getSignaturePositionConfig } from '@/lib/pdf/signature-config'
import { writeSignature, ensureSessionDir, getPdfPath } from '@/lib/storage/temp-files'
import { base64DataUrlToBuffer, sha256 } from '@/lib/crypto/hash'
import fs from 'fs'
import { POST } from '@/app/api/sign/capture/route'

/** Create a valid PNG buffer with enough size to pass route's minimum check */
function createValidPng(): Buffer {
  const width = 400
  const height = 300

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 2  // color type (RGB)
  const ihdr = makeChunk('IHDR', ihdrData)

  // Raw image data: filter byte + RGB per pixel per row, random-ish to avoid compression
  const rawData = Buffer.alloc((1 + width * 3) * height)
  for (let i = 0; i < rawData.length; i++) {
    rawData[i] = i % 256
  }
  const compressed = zlib.deflateSync(rawData)
  const idat = makeChunk('IDAT', compressed)
  const iend = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([t, data])
  let c = 0xffffffff
  for (let i = 0; i < crcInput.length; i++) {
    c ^= crcInput[i]
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0)
  return Buffer.concat([len, t, data, crc])
}

function makeRequest(employeeId: string) {
  const { NextRequest } = require('next/server')
  return new NextRequest(
    new Request('http://localhost:3000/api/sign/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-employee-id': employeeId,
      },
      body: JSON.stringify({ signatureBase64: 'data:image/png;base64,fakedata' }),
    })
  )
}

describe('sign/capture — personal_info_consent regeneration', () => {
  let validPng: Buffer

  beforeAll(() => {
    validPng = createValidPng()
    // Ensure our PNG is large enough to pass the 1000-byte minimum check
    expect(validPng.length).toBeGreaterThan(1000)
    // Ensure PNG header is valid
    expect(validPng[0]).toBe(0x89)
    expect(validPng.readUInt32BE(16)).toBe(400)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(base64DataUrlToBuffer as jest.Mock).mockReturnValue(validPng)
    ;(sha256 as jest.Mock).mockReturnValue('mock-hash')
    ;(writeSignature as jest.Mock).mockImplementation(() => {})
    ;(getPdfPath as jest.Mock).mockReturnValue('/tmp/test/personal_info_consent.pdf')
    ;(ensureSessionDir as jest.Mock).mockImplementation(() => {})
    ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {})
  })

  it('서명 저장 후 personal_info_consent PDF를 재생성함', async () => {
    const realPdf = await PDFDocument.create()
    realPdf.addPage()
    realPdf.addPage()
    realPdf.addPage()
    const pdfBytes = Buffer.from(await realPdf.save())

    ;(getEmployeeById as jest.Mock).mockResolvedValue({
      employee: {
        employee_id: 'EMP001', name: '홍길동', phone: '01012345678',
        department: '개발팀', position: '사무직', position_name: '사원',
        hire_date: '2026.03.16', address: '서울시', birthday: '1990.01.15',
        email: 'test@test.com', pay_sec: 'monthly', session_status: 'IN_PROGRESS',
        onboarding_link: '', role: 'employee',
      },
      rowIndex: 2,
    })
    ;(buildBaseVariables as jest.Mock).mockReturnValue({ name: '홍길동' })
    ;(generatePdf as jest.Mock).mockResolvedValue(pdfBytes)
    ;(getSignaturePositionConfig as jest.Mock).mockReturnValue({
      personal_info_consent: { page: 2, x: 466, y: 260, width: 40, height: 13 },
    })

    const response = await POST(makeRequest('EMP001'))
    const json = await response.json()

    // Wait for fire-and-forget async block to complete
    await new Promise(r => setTimeout(r, 100))

    expect(json.success).toBe(true)
    expect(getEmployeeById).toHaveBeenCalledWith('EMP001')
    expect(buildBaseVariables).toHaveBeenCalled()
    expect(generatePdf).toHaveBeenCalledWith('personal_info_consent', { name: '홍길동' })
    expect(ensureSessionDir).toHaveBeenCalledWith('EMP001')
    expect(fs.writeFileSync).toHaveBeenCalled()

    const writtenData = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as Buffer
    expect(writtenData.length).toBeGreaterThan(0)
  })

  it('재생성 실패 시에도 서명 저장은 성공함 (non-fatal)', async () => {
    ;(getEmployeeById as jest.Mock).mockRejectedValue(new Error('sheets error'))

    const response = await POST(makeRequest('EMP001'))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.signHash).toBe('mock-hash')
    expect(writeSignature).toHaveBeenCalledWith('EMP001', validPng)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('직원 정보가 없을 때 재생성 스킵 (no crash)', async () => {
    ;(getEmployeeById as jest.Mock).mockResolvedValue(null)

    const response = await POST(makeRequest('UNKNOWN'))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })
})
