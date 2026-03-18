import fs from 'fs'
import os from 'os'
import path from 'path'
import type { DocumentKey } from '@/types/document'

const BASE_DIR = path.join(os.tmpdir(), 'hr-sessions')

export function getSessionDir(employeeId: string): string {
  return path.join(BASE_DIR, employeeId)
}

export function ensureSessionDir(employeeId: string): string {
  const dir = getSessionDir(employeeId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getSignaturePath(employeeId: string): string {
  return path.join(getSessionDir(employeeId), 'signature.png')
}

export function getPdfPath(employeeId: string, documentKey: DocumentKey): string {
  return path.join(getSessionDir(employeeId), `${documentKey}.pdf`)
}

export function getPreviewPath(employeeId: string, documentKey: DocumentKey): string {
  return path.join(getSessionDir(employeeId), `${documentKey}_preview.png`)
}

/** Set file to owner-only read/write (no-op on Windows) */
function restrictPermissions(filePath: string): void {
  if (process.platform !== 'win32') {
    try { fs.chmodSync(filePath, 0o600) } catch { /* best-effort */ }
  }
}

export function writeSignature(employeeId: string, buffer: Buffer): string {
  ensureSessionDir(employeeId)
  const filePath = getSignaturePath(employeeId)
  fs.writeFileSync(filePath, buffer)
  restrictPermissions(filePath)
  return filePath
}

export function readSignature(employeeId: string): Buffer {
  const filePath = getSignaturePath(employeeId)
  if (!fs.existsSync(filePath)) {
    throw new Error(`서명 파일을 찾을 수 없습니다: ${employeeId}`)
  }
  return fs.readFileSync(filePath)
}

export function readPdf(employeeId: string, documentKey: DocumentKey): Buffer {
  const filePath = getPdfPath(employeeId, documentKey)
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF 파일을 찾을 수 없습니다: ${documentKey}`)
  }
  return fs.readFileSync(filePath)
}

export function pdfExists(employeeId: string, documentKey: DocumentKey): boolean {
  return fs.existsSync(getPdfPath(employeeId, documentKey))
}

export function deleteSessionDir(employeeId: string): void {
  const dir = getSessionDir(employeeId)
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // Silently ignore ENOENT from concurrent access
  }
}

export function getSessionDirMtime(employeeId: string): Date | null {
  const dir = getSessionDir(employeeId)
  if (!fs.existsSync(dir)) return null
  return fs.statSync(dir).mtime
}

export function listAllSessionIds(): string[] {
  if (!fs.existsSync(BASE_DIR)) return []
  return fs.readdirSync(BASE_DIR).filter((name) => {
    return fs.statSync(path.join(BASE_DIR, name)).isDirectory()
  })
}
