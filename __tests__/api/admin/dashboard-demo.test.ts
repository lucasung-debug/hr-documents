import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockGetSheetsClient = jest.fn()
const mockWithRetry = jest.fn()

jest.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: mockRequireAdmin,
}))

jest.mock('@/lib/sheets/client', () => ({
  getSheetsClient: mockGetSheetsClient,
  SPREADSHEET_ID: jest.fn(() => 'spreadsheet-id'),
  SHEET_NAMES: {
    EMPLOYEE_MASTER: 'EMPLOYEE_MASTER',
    DOCUMENT_STATUS: 'DOCUMENT_STATUS',
  },
  withRetry: mockWithRetry,
}))

import { GET } from '@/app/api/admin/dashboard/route'

function makeRequest(path: string) {
  return new NextRequest(new Request(`http://localhost:3000${path}`))
}

describe('GET /api/admin/dashboard demo mode', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalDemoEnabled = process.env.HR_DASHBOARD_DEMO_ENABLED

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      configurable: true,
    })
    if (originalDemoEnabled === undefined) {
      delete process.env.HR_DASHBOARD_DEMO_ENABLED
    } else {
      process.env.HR_DASHBOARD_DEMO_ENABLED = originalDemoEnabled
    }
    mockRequireAdmin.mockReturnValue(null)
    mockGetSheetsClient.mockReturnValue({
      spreadsheets: {
        values: {
          get: jest.fn(),
        },
      },
    })
  })

  it('returns fixture data for demo=1 without admin auth or Sheets', async () => {
    const response = await GET(makeRequest('/api/admin/dashboard?demo=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockRequireAdmin).not.toHaveBeenCalled()
    expect(mockGetSheetsClient).not.toHaveBeenCalled()
    expect(mockWithRetry).not.toHaveBeenCalled()
    expect(body.employees).toHaveLength(6)
    expect(body.stats.action_required).toBeGreaterThanOrEqual(1)
    expect(body.stats.sync_failed).toBeGreaterThanOrEqual(1)
    expect(body.stats.archive_pending).toBeGreaterThanOrEqual(1)
    expect(body.employees.some((employee: { action_required: string }) => employee.action_required === 'hr_review')).toBe(true)
  })

  it('does not allow demo=1 to bypass admin auth in production without the demo flag', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    })
    delete process.env.HR_DASHBOARD_DEMO_ENABLED
    mockRequireAdmin.mockReturnValue(NextResponse.json({ error: 'admin required' }, { status: 403 }))

    const response = await GET(makeRequest('/api/admin/dashboard?demo=1'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'admin required' })
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
    expect(mockGetSheetsClient).not.toHaveBeenCalled()
    expect(mockWithRetry).not.toHaveBeenCalled()
  })
})
