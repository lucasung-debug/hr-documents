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
      if (data.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/onboarding/privacy-consent')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-apple-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-[28px] font-bold text-apple-gray-900 tracking-[-0.02em]">
            입사 서류 전자서명
          </h1>
          <p className="text-apple-gray-500 mt-2 text-[15px]">
            이름과 휴대전화번호로 본인 확인을 해주세요.
          </p>
        </div>

        <div className="bg-white rounded-apple-xl shadow-apple-md border border-apple-gray-100 p-6 sm:p-8 lg:p-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
              <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">{error}</p>
            )}

            <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
              확인
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
