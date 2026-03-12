# PDF 서류 양식 (Templates)

이 디렉토리에 실제 HR 서류 양식 PDF 파일 7종을 배치해야 합니다.

## 필요한 파일 목록

| 파일명 | 서류명 | Sheets Key |
|---|---|---|
| `labor_contract.pdf` | 근로계약서 | labor_contract |
| `personal_info_consent.pdf` | 개인정보 수집·이용 동의서 | personal_info_consent |
| `bank_account.pdf` | 급여 이체 계좌 신청서 | bank_account |
| `health_certificate.pdf` | 건강진단서 제출 확인서 | health_certificate |
| `criminal_check_consent.pdf` | 범죄경력조회 동의서 | criminal_check_consent |
| `emergency_contact.pdf` | 비상연락망 등록 신청서 | emergency_contact |
| `data_security_pledge.pdf` | 정보보안 서약서 | data_security_pledge |

## 주의사항

- 모든 파일은 A4 (210mm × 297mm) 규격이어야 합니다.
- PDF는 암호화(PDF/A 포함)되지 않은 표준 PDF여야 합니다 (pdf-lib 호환성).
- 스캔 이미지 PDF의 경우 사전에 텍스트 PDF로 변환이 필요합니다.
- 서명 위치 좌표는 `config/signature-positions.json`에서 설정합니다.
  - pdf-lib의 Y축은 페이지 **하단** 기준입니다 (A4 = 841.89pt 높이).
  - 예: 페이지 상단에서 80mm 위치 = Y 841.89 - (80 × 2.835) = Y ≈ 615 pt

이 README 파일은 Git에 포함되어 있으나 실제 PDF 파일은 보안상 Git에 포함하지 않습니다.
