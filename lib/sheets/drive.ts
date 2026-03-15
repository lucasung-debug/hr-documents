import { google } from 'googleapis'

/**
 * Export a specific sheet tab as PDF via direct Sheets export URL.
 * This approach uses the Sheets export URL directly, which works
 * with the existing Sheets OAuth scope (no drive.readonly needed).
 */
export async function exportSheetTabAsPdf(
  spreadsheetId: string,
  sheetGid: number
): Promise<Buffer> {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_CLIENT_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing required environment variables: ' +
        'GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_CLIENT_REFRESH_TOKEN'
    )
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })

  // Get a fresh access token
  const { token } = await auth.getAccessToken()
  if (!token) throw new Error('Failed to get access token')

  // Build the Sheets PDF export URL (no Drive API scope required)
  const params = new URLSearchParams({
    format: 'pdf',
    gid: String(sheetGid),
    size: 'A4',
    portrait: 'true',
    scale: '2',       // 2 = fit to width (preserves page breaks, fits horizontally)
    gridlines: 'false',
    printtitle: 'false',
    sheetnames: 'false',
    fzr: 'false',
    top_margin: '0.25',
    bottom_margin: '0.25',
    left_margin: '0.25',
    right_margin: '0.25',
  })

  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params.toString()}`

  const response = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(
      `Sheets PDF export failed: ${response.status} ${response.statusText}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
