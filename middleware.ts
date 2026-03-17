import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/api/auth/login', '/login', '/_next', '/favicon.ico']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session_token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)

    // Inject employee_id into request headers for API routes to consume
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-employee-id', String(payload.employee_id ?? ''))
    requestHeaders.set('x-employee-name', encodeURIComponent(String(payload.name ?? '')))
    requestHeaders.set('x-employee-role', String(payload.role ?? 'employee'))

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session_token')
    return response
  }
}

export const config = {
  matcher: [
    '/onboarding/:path*',
    '/admin/:path*',
    '/api/sign/:path*',
    '/api/docs/:path*',
    '/api/employee/:path*',
    '/api/email/:path*',
    '/api/temp/:path*',
    '/api/admin/:path*',
  ],
}
