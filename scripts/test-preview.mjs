/**
 * Test script: Login → Preview documents → Check for 400 errors
 * Verifies Phase 2 bug fixes: exportWithRetry + checkbox
 */

const BASE = 'http://localhost:3000'

async function login(name, phone) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  })
  const data = await res.json()
  const cookie = res.headers.getSetCookie?.()?.find(c => c.startsWith('session_token='))
  if (!cookie) {
    console.error('Login failed:', data)
    process.exit(1)
  }
  const token = cookie.split(';')[0] // session_token=xxx
  console.log(`✓ Login success: ${name}`)
  return token
}

async function testPreview(token, documentKey) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}/api/docs/preview?documentKey=${documentKey}`, {
      headers: { Cookie: token },
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    if (res.ok) {
      const data = await res.json()
      const pdfLen = data.pdfBase64?.length || 0
      console.log(`✓ ${documentKey}: OK (${elapsed}s, base64 len=${pdfLen})`)
      return true
    } else {
      const data = await res.json()
      console.error(`✗ ${documentKey}: ${res.status} (${elapsed}s) - ${data.error?.slice(0, 120)}`)
      return false
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.error(`✗ ${documentKey}: ERROR (${elapsed}s) - ${err.message}`)
    return false
  }
}

// Test with 홍길영 (monthly pay)
const token = await login('홍길영', '01051654521')

console.log('\n--- Testing document previews ---')

// Test non-labor_contract docs (these were getting 400)
const docsToTest = [
  'holiday_extension',
  'data_security_pledge',
  'overtime_work',
  'personal_info_consent',
  'labor_contract',
]

let passed = 0
let failed = 0

for (const doc of docsToTest) {
  const ok = await testPreview(token, doc)
  if (ok) passed++; else failed++
}

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`)
process.exit(failed > 0 ? 1 : 0)
