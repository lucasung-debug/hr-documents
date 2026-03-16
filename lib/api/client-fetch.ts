'use client'

/**
 * Client-side fetch wrapper that handles 401 responses by redirecting to /login.
 * Use this instead of raw fetch() in client components to centralize session expiry handling.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init)

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.')
      window.location.href = '/login'
    }
    throw new Error('세션이 만료되었습니다.')
  }

  return res
}
