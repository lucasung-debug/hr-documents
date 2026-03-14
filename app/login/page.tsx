'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/components/providers/SessionProvider'

export default function LoginPage() {
  const router = useRouter()
  const { setEmployeeName } = useSession()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePhoneChange = (value: string) => {
    // Allow only digits
    setPhone(value.replace(/\D/g, '').slice(0, 11))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    if (phone.length < 10) { setError('올바른 휴대전화번호를 입력해주세요.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '로그인에 실패했습니다.')
        return
      }

      setEmployeeName(data.name)
      router.push('/onboarding/signature')
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">입사 서류 전자서명</h1>
          <p className="text-gray-500 mt-2">이름과 휴대전화번호로 본인 확인을 해주세요.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="login-name"
              label="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              disabled={loading}
              autoComplete="name"
            />
            <Input
              id="login-phone"
              label="휴대전화번호"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="01012345678 (숫자만 입력)"
              inputMode="numeric"
              disabled={loading}
              autoComplete="tel"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
              확인
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
