import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from '@/lib/sheets/client'
import type { OnboardingMaterial } from '@/types/api'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[employee/materials]')

function rowToMaterial(row: string[]): OnboardingMaterial {
  return {
    material_id: row[0] ?? '',
    title: row[1] ?? '',
    description: row[2] ?? '',
    file_url: row[3] ?? '',
    category: row[4] ?? '',
    order: parseInt(row[5] ?? '0', 10),
  }
}

/**
 * GET /api/employee/materials
 * Returns onboarding materials list from ONBOARDING_MATERIALS sheet.
 */
export async function GET(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const sheets = getSheetsClient()
    const response = await withRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID(),
        range: `${SHEET_NAMES.ONBOARDING_MATERIALS}!A2:F`,
      })
    )

    const rows = response.data.values ?? []
    const materials = rows
      .map((row) => rowToMaterial(row as string[]))
      .filter((m) => m.material_id && m.title)
      .sort((a, b) => a.order - b.order)

    return NextResponse.json({ materials })
  } catch (err) {
    log.error({ err }, '온보딩 자료 조회 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
