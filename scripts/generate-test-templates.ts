import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const TEMPLATES = [
  {
    key: 'labor_contract',
    title: 'Labor Contract',
    subtitle: 'Employment Agreement',
    lines: [
      'Article 1. This contract is effective from the date of employment.',
      'Article 2. The employee shall work at the designated location.',
      'Article 3. The employee shall faithfully perform assigned duties.',
    ],
    pages: 3,
  },
  {
    key: 'personal_info_consent',
    title: 'Personal Information Consent',
    subtitle: 'Collection & Use Agreement',
    lines: [
      'Purpose: Personnel management, payroll, benefits',
      'Items: Name, ID number, contact info, address',
      'Retention period: 3 years after termination',
    ],
    pages: 1,
  },
  {
    key: 'bank_account',
    title: 'Bank Account Registration',
    subtitle: 'Salary Transfer Request',
    lines: [
      'Bank: ___________________________',
      'Account Number: ___________________________',
      'Account Holder: ___________________________',
    ],
    pages: 1,
  },
  {
    key: 'health_certificate',
    title: 'Health Certificate Submission',
    subtitle: 'Medical Examination Confirmation',
    lines: [
      'I confirm submission of my health certificate.',
      'Examination Date: ___________________________',
      'Medical Institution: ___________________________',
    ],
    pages: 1,
  },
  {
    key: 'criminal_check_consent',
    title: 'Criminal Record Check Consent',
    subtitle: 'Background Verification Agreement',
    lines: [
      'I consent to a criminal record check for employment purposes.',
      'Purpose: Employment eligibility verification',
      'Authority: National Police Agency',
    ],
    pages: 1,
  },
  {
    key: 'emergency_contact',
    title: 'Emergency Contact Registration',
    subtitle: 'Emergency Contact Form',
    lines: [
      'Emergency Contact 1: ___________________________',
      'Relationship: ___________________________',
      'Emergency Contact 2: ___________________________',
    ],
    pages: 1,
  },
  {
    key: 'data_security_pledge',
    title: 'Data Security Pledge',
    subtitle: 'Information Security Agreement',
    lines: [
      'I pledge not to disclose any information acquired through work.',
      'I accept responsibility under applicable laws for violations.',
      'This pledge remains valid even after termination.',
    ],
    pages: 2,
  },
]

async function createPdf(template: (typeof TEMPLATES)[number]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89

  for (let p = 0; p < template.pages; p++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])

    // Header background
    page.drawRectangle({
      x: 0, y: pageHeight - 80, width: pageWidth, height: 80,
      color: rgb(0.15, 0.35, 0.6),
    })

    // Title
    page.drawText(template.title, {
      x: 50, y: pageHeight - 45, size: 18, font: fontBold, color: rgb(1, 1, 1),
    })

    // Subtitle
    page.drawText(template.subtitle, {
      x: 50, y: pageHeight - 65, size: 11, font, color: rgb(0.8, 0.85, 0.95),
    })

    // Page number
    page.drawText(`Page ${p + 1} / ${template.pages}`, {
      x: pageWidth - 110, y: pageHeight - 50, size: 10, font, color: rgb(0.8, 0.85, 0.95),
    })

    if (p === 0) {
      let y = pageHeight - 130
      for (const line of template.lines) {
        page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) })
        y -= 30
      }

      page.drawRectangle({
        x: 50, y: y - 10, width: pageWidth - 100, height: 1,
        color: rgb(0.8, 0.8, 0.8),
      })
    }

    // Signature area on last page
    if (p === template.pages - 1) {
      const sigY = 120
      page.drawRectangle({
        x: 320, y: sigY - 10, width: 220, height: 80,
        borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1,
        color: rgb(0.97, 0.97, 0.97),
      })
      page.drawText('Sign Here', {
        x: 395, y: sigY + 50, size: 9, font, color: rgb(0.5, 0.5, 0.5),
      })
      page.drawText('Date: ______ / ______ / ______', {
        x: 50, y: sigY + 20, size: 11, font, color: rgb(0.3, 0.3, 0.3),
      })
      page.drawText('Name: ___________________________', {
        x: 50, y: sigY - 10, size: 11, font, color: rgb(0.3, 0.3, 0.3),
      })
    }

    // Footer
    page.drawText('HR Documents System - Test Template', {
      x: 50, y: 30, size: 8, font, color: rgb(0.6, 0.6, 0.6),
    })
  }

  return pdfDoc.save()
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'templates')
  fs.mkdirSync(outDir, { recursive: true })

  console.log('Generating test PDF templates...\n')

  for (const template of TEMPLATES) {
    const pdfBytes = await createPdf(template)
    const filePath = path.join(outDir, `${template.key}.pdf`)
    fs.writeFileSync(filePath, pdfBytes)
    console.log(`  [OK] ${template.key}.pdf (${pdfBytes.length} bytes, ${template.pages} page(s))`)
  }

  console.log(`\nDone! ${TEMPLATES.length} templates created in ${outDir}`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
