import { SignJWT, jwtVerify } from 'jose'
import type { SessionPayload } from '@/types/employee'

const SESSION_DURATION_SECONDS = 30 * 60 // 30 minutes

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function signJwt(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getSecret()
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret)
}

export async function verifyJwt(token: string): Promise<SessionPayload> {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as SessionPayload
}
