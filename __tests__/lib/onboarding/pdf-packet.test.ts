import { PDFDocument } from 'pdf-lib'
import { buildOnboardingPdfPacket } from '@/lib/onboarding/pdf-packet'

async function createPdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([200, 200])
  }
  return Buffer.from(await doc.save())
}

async function getPageCount(pdf: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdf)
  return doc.getPageCount()
}

describe('buildOnboardingPdfPacket', () => {
  it('merges every page from every PDF attachment in order', async () => {
    const first = await createPdf(2)
    const second = await createPdf(3)

    const packet = await buildOnboardingPdfPacket([
      { filename: 'ignored-name-1.pdf', content: first, contentType: 'application/pdf' },
      { filename: 'ignored-name-2.pdf', content: second, contentType: 'application/pdf' },
    ])

    await expect(getPageCount(packet)).resolves.toBe(5)
  })

  it('ignores non-PDF attachments', async () => {
    const pdf = await createPdf(1)

    const packet = await buildOnboardingPdfPacket([
      { filename: 'ignored.txt', content: Buffer.from('not a pdf'), contentType: 'text/plain' },
      { filename: 'ignored.pdf', content: pdf, contentType: 'application/pdf' },
    ])

    await expect(getPageCount(packet)).resolves.toBe(1)
  })

  it('does not copy attachment filenames or PII into PDF metadata', async () => {
    const pdf = await createPdf(1)
    const packet = await buildOnboardingPdfPacket([
      {
        filename: 'Kim Sensitive_010-1234-5678_kim@example.com.pdf',
        content: pdf,
        contentType: 'application/pdf',
      },
    ])

    const text = packet.toString('latin1')
    expect(text).not.toContain('Kim Sensitive')
    expect(text).not.toContain('010-1234-5678')
    expect(text).not.toContain('kim@example.com')
  })
})
