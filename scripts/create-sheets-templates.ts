/**
 * Create 7 TPL_ sheet tabs in the Google Spreadsheet with placeholder layout.
 * Also creates EMPLOYEE_CONTRACT and ONBOARDING_MATERIALS tabs if missing.
 *
 * Usage: npx ts-node --project tsconfig.json scripts/create-sheets-templates.ts
 */

import fs from 'fs'
import path from 'path'

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? ''

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_CLIENT_REFRESH_TOKEN })
  return auth
}

interface TemplateConfig {
  sheetName: string
  title: string
  subtitle: string
  bodyRows: string[][]
  signatureRowIndex: number // row where signature placeholder goes
}

const TEMPLATES: TemplateConfig[] = [
  {
    sheetName: 'TPL_labor_contract',
    title: '근로계약서',
    subtitle: 'Employment Contract',
    bodyRows: [
      ['', ''],
      ['근 로 계 약 서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['부서:', '{{department}}'],
      ['직책:', '{{position}}'],
      ['입사일:', '{{hire_date}}'],
      ['', ''],
      ['제1조 (계약기간)', '본 계약은 입사일로부터 효력이 발생합니다.'],
      ['제2조 (근무장소)', '회사가 지정하는 장소에서 근무합니다.'],
      ['제3조 (급여)', '{{salary}}'],
      ['제4조 (근무시간)', '{{work_hours}}'],
      ['제5조 (복리후생)', '{{benefits}}'],
      ['제6조 (수습기간)', '{{probation_period}}'],
      ['제7조 (특약사항)', '{{special_terms}}'],
      ['', ''],
      ['위 내용에 동의하며 근로계약을 체결합니다.', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 19,
  },
  {
    sheetName: 'TPL_personal_info_consent',
    title: '개인정보 수집·이용 동의서',
    subtitle: 'Personal Information Consent',
    bodyRows: [
      ['', ''],
      ['개인정보 수집·이용 동의서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['', ''],
      ['1. 수집 목적', '인사·급여·복리후생 관리'],
      ['2. 수집 항목', '성명, 연락처, 주소, 주민등록번호, 계좌정보'],
      ['3. 보유 기간', '퇴직 후 3년'],
      ['4. 동의 거부 권리', '동의를 거부할 권리가 있으나, 거부 시 채용이 제한될 수 있습니다.'],
      ['', ''],
      ['본인은 위 내용을 확인하고 동의합니다.', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 13,
  },
  {
    sheetName: 'TPL_bank_account',
    title: '급여 이체 계좌 신청서',
    subtitle: 'Bank Account Registration',
    bodyRows: [
      ['', ''],
      ['급여 이체 계좌 신청서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['부서:', '{{department}}'],
      ['', ''],
      ['은행명:', ''],
      ['계좌번호:', ''],
      ['예금주:', '{{employee_name}}'],
      ['', ''],
      ['위 계좌로 급여 이체를 신청합니다.', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 13,
  },
  {
    sheetName: 'TPL_health_certificate',
    title: '건강진단서 제출 확인서',
    subtitle: 'Health Certificate Submission',
    bodyRows: [
      ['', ''],
      ['건강진단서 제출 확인서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['', ''],
      ['검진일:', ''],
      ['검진기관:', ''],
      ['', ''],
      ['위 건강진단서를 제출하였음을 확인합니다.', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 11,
  },
  {
    sheetName: 'TPL_criminal_check_consent',
    title: '범죄경력조회 동의서',
    subtitle: 'Criminal Record Check Consent',
    bodyRows: [
      ['', ''],
      ['범죄경력조회 동의서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['', ''],
      ['조회 목적:', '채용 적격 여부 확인'],
      ['조회 기관:', '경찰청'],
      ['', ''],
      ['본인은 채용 절차를 위한 범죄경력 조회에 동의합니다.', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 11,
  },
  {
    sheetName: 'TPL_emergency_contact',
    title: '비상연락망 등록 신청서',
    subtitle: 'Emergency Contact Registration',
    bodyRows: [
      ['', ''],
      ['비상연락망 등록 신청서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['부서:', '{{department}}'],
      ['', ''],
      ['비상연락처 1 (성명):', ''],
      ['비상연락처 1 (관계):', ''],
      ['비상연락처 1 (전화):', ''],
      ['', ''],
      ['비상연락처 2 (성명):', ''],
      ['비상연락처 2 (관계):', ''],
      ['비상연락처 2 (전화):', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 15,
  },
  {
    sheetName: 'TPL_data_security_pledge',
    title: '정보보안 서약서',
    subtitle: 'Data Security Pledge',
    bodyRows: [
      ['', ''],
      ['정보보안 서약서', ''],
      ['', ''],
      ['성명:', '{{employee_name}}'],
      ['부서:', '{{department}}'],
      ['', ''],
      ['1. 업무상 취득한 일체의 정보를 외부에 유출하지 않겠습니다.', ''],
      ['2. 관련 법령 위반 시 법적 책임을 지겠습니다.', ''],
      ['3. 본 서약은 퇴직 후에도 유효합니다.', ''],
      ['', ''],
      ['위 사항을 확인하고 서약합니다.', ''],
      ['', ''],
      ['날짜:', '{{date}}'],
      ['서명:', '{{signature}}'],
    ],
    signatureRowIndex: 13,
  },
]

const EXTRA_SHEETS = [
  {
    sheetName: 'EMPLOYEE_CONTRACT',
    headerRow: ['employee_id', 'salary', 'work_hours', 'benefits', 'probation_period', 'special_terms'],
  },
  {
    sheetName: 'ONBOARDING_MATERIALS',
    headerRow: ['material_id', 'title', 'description', 'file_url', 'category', 'order'],
  },
]

async function main() {
  if (!SPREADSHEET_ID) {
    console.error('Set GOOGLE_SPREADSHEET_ID environment variable')
    process.exit(1)
  }

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // Get existing sheet names
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties.title',
  })
  const existingNames = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '')
  )

  // Create template sheets
  for (const tpl of TEMPLATES) {
    if (existingNames.has(tpl.sheetName)) {
      console.log(`  [SKIP] ${tpl.sheetName} already exists`)
      continue
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tpl.sheetName } } }],
      },
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tpl.sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: tpl.bodyRows },
    })

    console.log(`  [OK] ${tpl.sheetName} created (${tpl.bodyRows.length} rows)`)
  }

  // Create extra data sheets
  for (const extra of EXTRA_SHEETS) {
    if (existingNames.has(extra.sheetName)) {
      console.log(`  [SKIP] ${extra.sheetName} already exists`)
      continue
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: extra.sheetName } } }],
      },
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${extra.sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [extra.headerRow] },
    })

    console.log(`  [OK] ${extra.sheetName} created with header`)
  }

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
