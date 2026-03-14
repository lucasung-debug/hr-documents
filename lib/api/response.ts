import { NextResponse } from 'next/server'
import { AppError, ErrorCode, ERROR_CODES } from '@/lib/errors'
import { logger } from '@/lib/logger'

export function apiOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status: number, code?: ErrorCode): NextResponse {
  return NextResponse.json({ error: message, code }, { status })
}

export function apiFromAppError(err: AppError): NextResponse {
  return apiError(err.message, err.statusCode, err.code)
}

export function apiFromUnknown(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return apiFromAppError(err)
  }
  logger.error(err)
  const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.'
  return apiError(message, 500, ERROR_CODES.SERVER_002)
}
