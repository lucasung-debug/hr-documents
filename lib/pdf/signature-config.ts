import path from 'path'
import fs from 'fs'
import type { SignaturePositionConfig, SignaturePositionKey } from '@/types/pdf'

let cachedConfig: SignaturePositionConfig | null = null

// All keys that must exist in signature-positions.json
const REQUIRED_KEYS: SignaturePositionKey[] = [
  'labor_contract',
  'labor_contract_monthly',
  'labor_contract_daily',
  'personal_info_consent',
  'bank_account',
  'health_certificate',
  'criminal_check_consent',
  'emergency_contact',
  'data_security_pledge',
]

export function getSignaturePositionConfig(): SignaturePositionConfig {
  const isDev = process.env.NODE_ENV !== 'production'
  if (!isDev && cachedConfig) return cachedConfig

  const configPath = path.join(process.cwd(), 'config', 'signature-positions.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw)

  const config: Partial<SignaturePositionConfig> = {}
  for (const key of REQUIRED_KEYS) {
    if (!parsed[key]) continue // Optional keys can be missing
    const raw = parsed[key]
    // Support both single position and array of positions
    if (Array.isArray(raw)) {
      config[key] = raw.map((p: Record<string, number>) => ({
        page: Number(p.page),
        x: Number(p.x),
        y: Number(p.y),
        width: Number(p.width),
        height: Number(p.height),
      }))
    } else {
      config[key] = {
        page: Number(raw.page),
        x: Number(raw.x),
        y: Number(raw.y),
        width: Number(raw.width),
        height: Number(raw.height),
      }
    }
  }

  cachedConfig = config as SignaturePositionConfig
  return cachedConfig
}
