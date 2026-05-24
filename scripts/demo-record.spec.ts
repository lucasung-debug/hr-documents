import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const STEP_WAIT_MS = 1_200
const LONG_WAIT_MS = 2_000

const DOCUMENTS_TO_COMPLETE = [
  '근로계약서',
  '연차유급휴가 이월·미사용수당 지급기일 연장 동의서',
  '보안 서약서',
  '준법행동 실천 서약서',
  '연장·야간·휴일근로 동의서',
]

test('records the HR onboarding demo flow', async ({ page }) => {
  const samplePdfBase64 = readFileSync(
    path.join(process.cwd(), 'public', 'demo', 'sample-signed-contract.pdf')
  ).toString('base64')

  await page.route('**/api/docs/preview?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, pdfBase64: samplePdfBase64 }),
    })
  })

  // S0: landing page (ad opening) — now a real landing page, not a redirect
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '출근 첫날, 서류는 아직도 종이로?' })).toBeVisible()
  await page.waitForTimeout(LONG_WAIT_MS)

  // enter the new-hire demo (demo mode via ?demo=1)
  await page.goto('/login?demo=1')
  await expect(page.getByText('데모 모드')).toBeVisible()
  await page.waitForTimeout(STEP_WAIT_MS)

  await typeLogin(page)
  await page.getByRole('button', { name: '데모 시작' }).click()
  await page.waitForURL('**/onboarding/privacy-consent')
  await page.waitForTimeout(STEP_WAIT_MS)

  await page.getByLabel('전체 동의').check()
  await page.waitForTimeout(STEP_WAIT_MS)
  await page.getByRole('button', { name: '동의 후 다음 단계' }).click()
  await page.waitForURL('**/onboarding/signature')

  // accept the signature-integrity notice (P2-S2) before the signature pad appears
  await page.getByRole('button', { name: '확인 후 서명 진행' }).click()
  await page.waitForTimeout(STEP_WAIT_MS)

  await drawDemoSignature(page)
  await page.waitForTimeout(STEP_WAIT_MS)
  await page.getByRole('button', { name: '서명 완료' }).click()
  await expect(page.getByText('서명이 완료되었습니다.')).toBeVisible()
  await page.waitForTimeout(STEP_WAIT_MS)
  await page.getByRole('button', { name: '다음 단계로' }).click()
  await page.waitForURL('**/onboarding/documents')
  await expect(page.getByRole('heading', { name: '입사 서류 작성' })).toBeVisible()

  // ASSUMPTION: the current DocumentsPage disables "다음 단계로" until every
  // non-privacy document is signed, so the first three are paced and the rest
  // are completed faster to keep the recording aligned with the shot list.
  for (const [index, label] of DOCUMENTS_TO_COMPLETE.entries()) {
    await completeDocument(page, label, index < 3 ? STEP_WAIT_MS : 500)
  }

  await page.getByRole('button', { name: '다음 단계로' }).click()
  await page.waitForURL('**/onboarding/preview')
  await expect(page.getByRole('heading', { name: '서류 최종 확인' })).toBeVisible()
  await expect(page.getByTestId('demo-document').first()).toBeVisible()
  await page.waitForTimeout(LONG_WAIT_MS)

  await page.getByRole('button', { name: '확인 완료' }).click()
  await page.waitForURL('**/onboarding/employee-id')
  await expect(page.getByRole('heading', { name: '사번 배정 안내' })).toBeVisible()
  await page.waitForTimeout(STEP_WAIT_MS)

  await page.getByRole('button', { name: '서류 최종 전송' }).click()
  await page.waitForURL('**/onboarding/complete')
  await expect(page.getByRole('heading', { name: '완료되었습니다.' })).toBeVisible()
  await expect(page.getByTestId('demo-document').first()).toBeVisible()
  await page.waitForTimeout(LONG_WAIT_MS)

  // ASSUMPTION: /admin/dashboard?demo=1 returns fixture data, but app/admin/layout.tsx
  // still requires the x-employee-role header normally injected by middleware for admins.
  await page.setExtraHTTPHeaders({ 'x-employee-role': 'admin' })
  await page.goto('/admin/dashboard?demo=1')
  await expect(page.getByRole('heading', { name: 'HR 온보딩 대시보드' })).toBeVisible()
  await expect(page.getByText('데모 모드: 가상 입사자 데이터')).toBeVisible()
  await expect(page.locator('#progress_chart')).toBeVisible()
  await page.waitForTimeout(LONG_WAIT_MS)

  await page.getByRole('button', { name: '조치 필요' }).click()
  await expect(page.getByText('박도현').first()).toBeVisible()
  await page.waitForTimeout(LONG_WAIT_MS)

})

async function typeLogin(page: Page) {
  await replaceText(page, '이름', '홍길동')
  await page.waitForTimeout(400)
  await replaceText(page, '휴대전화번호', '01000000000')
  await page.waitForTimeout(STEP_WAIT_MS)
}

async function replaceText(page: Page, label: string, value: string) {
  const input = page.getByLabel(label)
  await input.click()
  await input.press('Control+A')
  await page.keyboard.type(value, { delay: 80 })
}

async function drawDemoSignature(page: Page) {
  const canvas = page.locator('canvas').first()
  await canvas.waitFor({ state: 'visible' })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Signature canvas is not visible')

  const points = [
    [0.18, 0.55],
    [0.28, 0.36],
    [0.38, 0.62],
    [0.48, 0.42],
    [0.58, 0.58],
    [0.68, 0.40],
    [0.78, 0.52],
  ]

  await page.mouse.move(box.x + box.width * points[0][0], box.y + box.height * points[0][1])
  await page.mouse.down()
  for (const [x, y] of points.slice(1)) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 10 })
  }
  await page.mouse.up()
}

async function completeDocument(page: Page, label: string, pauseMs: number) {
  const card = page
    .getByRole('heading', { name: label, exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-apple-lg")][1]')

  await card.scrollIntoViewIfNeeded()
  await expect(card).toBeVisible()
  await page.waitForTimeout(pauseMs)

  await card.getByRole('button', { name: /서류 미리보기/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`${label} — 미리보기`)
  await expect(dialog.getByRole('link', { name: 'PDF 다운로드' }).first()).toBeVisible()
  await page.waitForTimeout(pauseMs)
  await page.getByRole('button', { name: '닫기' }).first().click()
  await expect(dialog).toBeHidden()

  await card.getByLabel('본 서류의 내용을 확인하였으며, 동의합니다.').check()
  await page.waitForTimeout(Math.min(pauseMs, STEP_WAIT_MS))
  await card.getByRole('button', { name: '서명 및 제출' }).click()
  await expect(card.getByText('서명이 완료되었습니다.')).toBeVisible()
  await page.waitForTimeout(pauseMs)
}
