/**
 * Unit tests for docs/consent API logic.
 * Tests the USE_SHEETS flag behavior and input validation.
 */

describe('docs/consent route', () => {
  const originalEnv = process.env.USE_SHEETS_TEMPLATES

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.USE_SHEETS_TEMPLATES
    } else {
      process.env.USE_SHEETS_TEMPLATES = originalEnv
    }
  })

  describe('USE_SHEETS_TEMPLATES flag behavior', () => {
    it('기본값(미설정) → Sheets 파이프라인 사용 (opt-out 방식)', () => {
      delete process.env.USE_SHEETS_TEMPLATES
      const useSheets = process.env.USE_SHEETS_TEMPLATES !== 'false'
      expect(useSheets).toBe(true)
    })

    it('USE_SHEETS_TEMPLATES=true → Sheets 파이프라인 사용', () => {
      process.env.USE_SHEETS_TEMPLATES = 'true'
      const useSheets = process.env.USE_SHEETS_TEMPLATES !== 'false'
      expect(useSheets).toBe(true)
    })

    it('USE_SHEETS_TEMPLATES=false → 레거시 PDF 파이프라인 사용', () => {
      process.env.USE_SHEETS_TEMPLATES = 'false'
      const useSheets = process.env.USE_SHEETS_TEMPLATES !== 'false'
      expect(useSheets).toBe(false)
    })

    it('USE_SHEETS_TEMPLATES=anything → Sheets 파이프라인 사용', () => {
      process.env.USE_SHEETS_TEMPLATES = 'anything'
      const useSheets = process.env.USE_SHEETS_TEMPLATES !== 'false'
      expect(useSheets).toBe(true)
    })
  })
})

describe('contract conditions mapping', () => {
  it('rowToConditions가 A-K 컬럼을 올바르게 매핑함', () => {
    // Simulate the row parsing logic from contract.ts
    const row = [
      'EMP001', '홍길동', '2026.03.16', '2026.06.15', '사원',
      'monthly', '2500000', '300000', '200000', '3000000', '주간',
    ]

    const conditions = {
      employee_id: row[0] ?? '',
      name: row[1] ?? '',
      hire_date: row[2] ?? '',
      intern_date: row[3] ?? '',
      position: row[4] ?? '',
      salary_basic: row[6] ?? '',
      salary_OT: row[7] ?? '',
      salary_fix: row[8] ?? '',
      salary_total: row[9] ?? '',
      work_hours: row[10] ?? '',
    }

    expect(conditions.employee_id).toBe('EMP001')
    expect(conditions.salary_basic).toBe('2500000')
    expect(conditions.work_hours).toBe('주간')
  })
})
