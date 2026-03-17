import path from 'path'
import fs from 'fs'
import type { SignaturePosition, SignaturePositionConfig, SignaturePositionKey } from '@/types/pdf'
import { createLogger } from '@/lib/logger'

const log = createLogger('[signature-config]')

let cachedConfig: SignaturePositionConfig | null = null

// All keys that must exist in signature-positions.json
const REQUIRED_KEYS: SignaturePositionKey[] = [
  'labor_contract',
  'labor_contract_monthly',
  'labor_contract_daily',
  'personal_info_consent',
  'holiday_extension',
  'data_security_pledge',
  'compliance',
  'overtime_work',
]

// A4 page size in points
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

function validatePosition(pos: SignaturePosition, key: string, index?: number): void {
  const label = index !== undefined ? `${key}[${index}]` : key

  if (pos.page < 0 || !Number.isFinite(pos.page)) {
    throw new Error(`Invalid page number for ${label}: ${pos.page}`)
  }
  if (pos.x < 0 || pos.y < 0) {
    throw new Error(`Invalid negative coordinate for ${label}: x=${pos.x}, y=${pos.y}`)
  }
  if (pos.width <= 0 || pos.height <= 0) {
    throw new Error(`Invalid size for ${label}: ${pos.width}x${pos.height}`)
  }
  if (pos.x + pos.width > A4_WIDTH * 1.1 || pos.y + pos.height > A4_HEIGHT * 1.1) {
    log.warn(`Position may be out of A4 bounds for ${label}: x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height}`)
  }
}

function parsePosition(raw: Record<string, number>): SignaturePosition {
  return {
    page: Number(raw.page),
    x: Number(raw.x),
    y: Number(raw.y),
    width: Number(raw.width),
    height: Number(raw.height),
  }
}

export function getSignaturePositionConfig(): SignaturePositionConfig {
  const isDev = process.env.NODE_ENV !== 'production'
  if (!isDev && cachedConfig) return cachedConfig

  const configPath = path.join(process.cwd(), 'config', 'signature-positions.json')
  const rawContent = fs.readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(rawContent)

  const config: Partial<SignaturePositionConfig> = {}
  for (const key of REQUIRED_KEYS) {
    if (!parsed[key]) {
      throw new Error(`Missing required signature position key: ${key}`)
    }
    const raw = parsed[key]
    // Support both single position and array of positions
    if (Array.isArray(raw)) {
      const positions = raw.map((p: Record<string, number>, i: number) => {
        const pos = parsePosition(p)
        validatePosition(pos, key, i)
        return pos
      })
      config[key] = positions
    } else {
      const pos = parsePosition(raw)
      validatePosition(pos, key)
      config[key] = pos
    }
  }

  cachedConfig = config as SignaturePositionConfig
  return cachedConfig
}
