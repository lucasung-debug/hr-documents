import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'

let sheetsClient: sheets_v4.Sheets | null = null
let authClient: InstanceType<typeof google.auth.OAuth2> | null = null

export function getAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  if (authClient) return authClient

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_CLIENT_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing required environment variables: ' +
        'GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_CLIENT_REFRESH_TOKEN'
    )
  }

  authClient = new google.auth.OAuth2(clientId, clientSecret)
  authClient.setCredentials({ refresh_token: refreshToken })
  return authClient
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    throw new Error('Missing required environment variable: GOOGLE_SPREADSHEET_ID')
  }

  const auth = getAuthClient()
  sheetsClient = google.sheets({ version: 'v4', auth })
  return sheetsClient
}

export const SPREADSHEET_ID = (): string => {
  const id = process.env.GOOGLE_SPREADSHEET_ID
  if (!id) throw new Error('GOOGLE_SPREADSHEET_ID is not set')
  return id
}

export const SHEET_NAMES = {
  EMPLOYEE_MASTER: process.env.SHEET_EMPLOYEE_MASTER ?? 'EMPLOYEE_MASTER',
  DOCUMENT_STATUS: process.env.SHEET_DOCUMENT_STATUS ?? 'DOCUMENT_STATUS',
  EMPLOYEE_CONTRACT: 'EMPLOYEE_CONTRACT',
  ONBOARDING_MATERIALS: 'ONBOARDING_MATERIALS',
} as const

// Retry helper with exponential backoff for Sheets API calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: Error | unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
      }
    }
  }
  throw lastError
}
