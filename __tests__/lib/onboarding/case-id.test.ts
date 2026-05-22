import { deriveCaseId } from '@/lib/onboarding/case-id'

describe('deriveCaseId', () => {
  it('derives an onboarding case ID from an employee ID', () => {
    expect(deriveCaseId('EMP001')).toBe('ONB-EMP001')
  })

  it('trims surrounding whitespace before deriving the case ID', () => {
    expect(deriveCaseId('  EMP001  ')).toBe('ONB-EMP001')
  })

  it('is deterministic for the same employee ID', () => {
    expect(deriveCaseId('EMP001')).toBe(deriveCaseId('EMP001'))
  })

  it('throws for an empty employee ID', () => {
    expect(() => deriveCaseId('')).toThrow('employeeId is required')
    expect(() => deriveCaseId('   ')).toThrow('employeeId is required')
  })

  it('allows ASCII letters, digits, underscores, and hyphens', () => {
    expect(deriveCaseId('EMP_001-A')).toBe('ONB-EMP_001-A')
  })

  it('throws for invalid employee ID characters', () => {
    expect(() => deriveCaseId('EMP 001')).toThrow(
      'employeeId may only contain ASCII letters, digits, underscores, and hyphens'
    )
    expect(() => deriveCaseId('EMP/001')).toThrow(
      'employeeId may only contain ASCII letters, digits, underscores, and hyphens'
    )
  })

  it('throws for employee IDs longer than 64 characters after trimming', () => {
    expect(() => deriveCaseId(` ${'A'.repeat(65)} `)).toThrow(
      'employeeId must be 64 characters or fewer'
    )
  })
})
