import path from 'path'
import fs from 'fs'
import type { SignaturePositionConfig } from '@/types/pdf'
import { DOCUMENT_KEYS } from '@/types/document'

let cachedConfig: SignaturePositionConfig | null = null

export function getSignaturePositionConfig(): SignaturePositionConfig {
  if (cachedConfig) return cachedConfig

  const configPath = path.join(process.cwd(), 'config', 'signature-positions.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw)

  // Remove the _comment field and validate all document keys are present
  const config: Partial<SignaturePositionConfig> = {}
  for (const key of DOCUMENT_KEYS) {
    if (!parsed[key]) {
      throw new Error(`signature-positions.json is missing entry for: ${key}`)
    }
    config[key] = {
      page: Number(parsed[key].page),
      x: Number(parsed[key].x),
      y: Number(parsed[key].y),
      width: Number(parsed[key].width),
      height: Number(parsed[key].height),
    }
  }

  cachedConfig = config as SignaturePositionConfig
  return cachedConfig
}
