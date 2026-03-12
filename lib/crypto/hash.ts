import { createHash } from 'crypto'

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export function sha256FromBase64(base64: string): string {
  const dataBuffer = base64DataUrlToBuffer(base64)
  return sha256(dataBuffer)
}

export function base64DataUrlToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}
