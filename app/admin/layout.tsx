'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleLogout = () => {
    document.cookie = 'session_token=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-apple-gray-50">
      <header className="bg-white border-b border-apple-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-apple-gray-900 tracking-tight truncate">
            HR 온보딩 대시보드
          </h1>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
