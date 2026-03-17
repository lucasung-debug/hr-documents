import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: '입사 서류 전자서명',
  description: '신규 입사자 온보딩 전자서명 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '전자서명',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
