import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { AccessDenied } from './access-denied'

async function logout() {
  'use server'
  cookies().delete('session_token')
  redirect('/login')
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const role = headers().get('x-employee-role')

  if (role !== 'admin') {
    return <AccessDenied />
  }

  return (
    <div className="min-h-screen bg-apple-gray-50">
      <header className="bg-white border-b border-apple-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-apple-gray-900 tracking-tight truncate">
            HR 온보딩 대시보드
          </h1>
          <form action={logout}>
            <Button type="submit" variant="secondary" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
