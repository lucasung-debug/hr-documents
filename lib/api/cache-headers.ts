import { NextResponse } from 'next/server'

/**
 * Add Cache-Control header to a response.
 * Uses `private` directive since responses contain user-specific data.
 */
export function withCacheHeaders(response: NextResponse, maxAgeSec: number): NextResponse {
  response.headers.set('Cache-Control', `private, max-age=${maxAgeSec}`)
  return response
}
