import { buildBaseVariables, buildContractVariables, buildBankVariables } from '@/lib/sheets/template-variables'
import type { EmployeeMasterRow } from '@/types/employee'
import type { ContractConditions } from '@/lib/sheets/contract'

describe('buildBaseVariables', () => {
  const mockEmployee: EmployeeMasterRow = {
    employee_id: 'EMP001',
    name: '홍길동',
    phone: '010-1234-5678',
    department: '개발팀',
    position: '사원',
    hire_date: '2026.03.16',
    address: '서울시 강남구',
    birthday: '1990.01.15',
    email: 'hong@test.com',
    pay_sec: 'monthly',
    session_status: 'IN_PROGRESS',
    onboarding_link: '',
    role: 'employee',
  }

  it('직원 정보에서 기본 변수를 올바르게 생성함', () => {
    const vars = buildBaseVariables(mockEmployee)

    expect(vars.employee_name).toBe('홍길동')
    expect(vars.name).toBe('홍길동')
    expect(vars.department).toBe('개발팀')
    expect(vars.position).toBe('사원')
    expect(vars.hire_date).toBe('2026.03.16')
    expect(vars.adrress).toBe('서울시 강남구') // typo preserved
    expect(vars.birthday).toBe('1990.01.15')
    expect(vars.signature).toBe('')
  })

  it('오늘 날짜를 yy/mm/dd로 분리함', () => {
    const vars = buildBaseVariables(mockEmployee)

    expect(vars.date_yy).toMatch(/^\d{4}$/)
    expect(vars.date_mm).toMatch(/^\d{2}$/)
    expect(vars.date_dd).toMatch(/^\d{2}$/)
  })

  it('입사일을 yy/mm/dd로 분리함', () => {
    const vars = buildBaseVariables(mockEmployee)

    expect(vars.hire_date_yy).toBe('2026')
    expect(vars.hire_date_mm).toBe('03')
    expect(vars.hire_date_dd).toBe('16')
  })
})

describe('buildContractVariables', () => {
  const mockConditions: ContractConditions = {
    employee_id: 'EMP001',
    name: '홍길동',
    hire_date: '2026.03.16',
    intern_date: '2026.06.15',
    position: '주임',
    salary_basic: '2,500,000',
    salary_OT: '300,000',
    salary_fix: '200,000',
    salary_total: '3,000,000',
    work_hours: '주간',
    benefits: '4대보험',
    probation_period: '3개월',
    special_terms: '없음',
    bank_name: '국민은행',
    account_number: '123-456-7890',
  }

  it('급여 및 근로 조건 변수를 올바르게 생성함', () => {
    const vars = buildContractVariables(mockConditions)

    expect(vars.position).toBe('주임')
    expect(vars.salary_basic).toBe('2,500,000')
    expect(vars.salary_OT).toBe('300,000')
    expect(vars.salary_fix).toBe('200,000')
    expect(vars.salary_total).toBe('3,000,000')
    expect(vars.work_hours).toBe('주간')
  })

  it('추가 계약 조건 변수를 포함함', () => {
    const vars = buildContractVariables(mockConditions)

    expect(vars.benefits).toBe('4대보험')
    expect(vars.probation_period).toBe('3개월')
    expect(vars.special_terms).toBe('없음')
  })

  it('수습 종료일을 yy/mm/dd로 분리함', () => {
    const vars = buildContractVariables(mockConditions)

    expect(vars.intern_date_yy).toBe('2026')
    expect(vars.intern_date_mm).toBe('06')
    expect(vars.intern_date_dd).toBe('15')
  })

  it('빈 문자열 조건도 graceful하게 처리함', () => {
    const emptyConditions: ContractConditions = {
      employee_id: 'EMP002',
      name: '',
      hire_date: '',
      intern_date: '',
      position: '',
      salary_basic: '',
      salary_OT: '',
      salary_fix: '',
      salary_total: '',
      work_hours: '',
      benefits: '',
      probation_period: '',
      special_terms: '',
      bank_name: '',
      account_number: '',
    }

    const vars = buildContractVariables(emptyConditions)

    expect(vars.salary_basic).toBe('')
    expect(vars.benefits).toBe('')
    expect(vars.probation_period).toBe('')
    expect(vars.special_terms).toBe('')
  })
})

describe('buildBankVariables', () => {
  it('계좌 정보 변수를 올바르게 생성함', () => {
    const conditions: ContractConditions = {
      employee_id: 'EMP001',
      name: '홍길동',
      hire_date: '2026.03.16',
      intern_date: '2026.06.15',
      position: '사원',
      salary_basic: '2,500,000',
      salary_OT: '300,000',
      salary_fix: '200,000',
      salary_total: '3,000,000',
      work_hours: '주간',
      benefits: '',
      probation_period: '',
      special_terms: '',
      bank_name: '국민은행',
      account_number: '123-456-7890',
    }

    const vars = buildBankVariables(conditions)
    expect(vars.bank_name).toBe('국민은행')
    expect(vars.account_number).toBe('123-456-7890')
  })

  it('빈 계좌 정보도 graceful하게 처리함', () => {
    const conditions: ContractConditions = {
      employee_id: 'EMP002',
      name: '',
      hire_date: '',
      intern_date: '',
      position: '',
      salary_basic: '',
      salary_OT: '',
      salary_fix: '',
      salary_total: '',
      work_hours: '',
      benefits: '',
      probation_period: '',
      special_terms: '',
      bank_name: '',
      account_number: '',
    }

    const vars = buildBankVariables(conditions)
    expect(vars.bank_name).toBe('')
    expect(vars.account_number).toBe('')
  })
})
