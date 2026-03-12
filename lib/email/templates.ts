import type { EmployeeMasterRow } from '@/types/employee'

export function buildHrEmailBody(employee: EmployeeMasterRow): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px;">
    신규 입사자 서류 제출 완료 안내
  </h2>
  <p>아래 신규 입사자의 온보딩 서류가 전자서명을 통해 제출되었습니다.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">항목</th>
      <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">내용</th>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #d1d5db;">사번</td>
      <td style="padding: 10px; border: 1px solid #d1d5db;">${employee.employee_id}</td>
    </tr>
    <tr style="background-color: #f9fafb;">
      <td style="padding: 10px; border: 1px solid #d1d5db;">성명</td>
      <td style="padding: 10px; border: 1px solid #d1d5db;">${employee.name}</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #d1d5db;">부서</td>
      <td style="padding: 10px; border: 1px solid #d1d5db;">${employee.department}</td>
    </tr>
    <tr style="background-color: #f9fafb;">
      <td style="padding: 10px; border: 1px solid #d1d5db;">직책</td>
      <td style="padding: 10px; border: 1px solid #d1d5db;">${employee.position}</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #d1d5db;">입사일</td>
      <td style="padding: 10px; border: 1px solid #d1d5db;">${employee.hire_date}</td>
    </tr>
  </table>
  <p>총 7종 서류가 첨부 파일로 포함되어 있습니다. 검토 후 내부 시스템에 등록해주세요.</p>
  <p style="color: #6b7280; font-size: 0.85em; margin-top: 30px;">
    본 이메일은 전자서명 자동 발송 시스템에 의해 자동 생성되었습니다.
  </p>
</body>
</html>
  `.trim()
}

export function buildEmployeeEmailBody(employee: EmployeeMasterRow): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px;">
    입사 서류 제출 완료 확인
  </h2>
  <p>${employee.name}님, 안녕하세요.</p>
  <p>입사 서류 7종에 대한 전자서명이 성공적으로 완료되었습니다.</p>
  <p>서명된 서류 사본이 첨부 파일로 포함되어 있으니 보관하시기 바랍니다.</p>
  ${employee.onboarding_link ? `
  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <strong>온보딩 자료 다운로드</strong><br>
    <a href="${employee.onboarding_link}" style="color: #2563eb;">
      ${employee.onboarding_link}
    </a>
  </div>
  ` : ''}
  <p>입사를 진심으로 축하드리며, 함께 일하게 되어 기쁩니다.</p>
  <p style="color: #6b7280; font-size: 0.85em; margin-top: 30px;">
    본 이메일은 전자서명 자동 발송 시스템에 의해 자동 생성되었습니다.
  </p>
</body>
</html>
  `.trim()
}

export function buildHrEmailSubject(employeeName: string): string {
  return `[인사] ${employeeName} 신규 입사자 서류 제출 완료`
}

export function buildEmployeeEmailSubject(): string {
  return '[입사 서류] 전자서명 완료 확인 및 서류 사본 안내'
}
