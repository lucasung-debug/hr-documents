import { execFileSync } from 'child_process'
import { getAuthClient } from './client'

/**
 * Per-document PDF export configuration.
 * scale: '1'=100%, '2'=fit to width, '3'=fit to height, '4'=fit to page
 */
export interface PdfExportConfig {
  scale: '1' | '2' | '3' | '4'
  top_margin: string
  bottom_margin: string
  left_margin: string
  right_margin: string
}

/**
 * Row/column range for per-page PDF export (0-indexed, exclusive end).
 * Used to export specific row ranges as individual pages.
 */
export interface PdfExportRange {
  r1: number
  r2: number
  c1?: number
  c2?: number
}

const DEFAULT_PDF_CONFIG: PdfExportConfig = {
  scale: '4',
  top_margin: '0.25',
  bottom_margin: '0.25',
  left_margin: '0.25',
  right_margin: '0.25',
}

/**
 * Export a specific sheet tab as PDF via direct Sheets export URL.
 * Uses a child process for the HTTP request to bypass Next.js's
 * patched networking layer which breaks Google Sheets cross-origin redirects.
 */
export async function exportSheetTabAsPdf(
  spreadsheetId: string,
  sheetGid: number,
  config?: Partial<PdfExportConfig>,
  range?: PdfExportRange
): Promise<Buffer> {
  const auth = getAuthClient()

  // Get a fresh access token
  const { token } = await auth.getAccessToken()
  if (!token) throw new Error('Failed to get access token')

  // Merge caller config with defaults
  const cfg = { ...DEFAULT_PDF_CONFIG, ...config }

  // Build the Sheets PDF export URL (no Drive API scope required)
  const params = new URLSearchParams({
    format: 'pdf',
    gid: String(sheetGid),
    size: 'A4',
    portrait: 'true',
    scale: cfg.scale,
    gridlines: 'false',
    printtitle: 'false',
    sheetnames: 'false',
    fzr: 'false',
    top_margin: cfg.top_margin,
    bottom_margin: cfg.bottom_margin,
    left_margin: cfg.left_margin,
    right_margin: cfg.right_margin,
  })

  // Add row/column range for per-page exports
  if (range) {
    params.set('ir', 'false')
    params.set('ic', 'false')
    params.set('r1', String(range.r1))
    params.set('r2', String(range.r2))
    params.set('c1', String(range.c1 ?? 0))
    params.set('c2', String(range.c2 ?? 20))
  }

  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params.toString()}`

  // Execute HTTP request in a child process to bypass Next.js networking layer.
  // Next.js patches global fetch, causing Google Sheets export redirects to fail.
  // Node.js 18+ has built-in fetch which works correctly in a clean subprocess.
  const script = `
    fetch(process.argv[1], { headers: { Authorization: 'Bearer ' + process.argv[2] } })
      .then(r => {
        if (!r.ok) {
          return r.text().then(t => {
            process.stderr.write('STATUS=' + r.status + ' ' + t.slice(0, 300));
            process.exit(1);
          });
        }
        return r.arrayBuffer();
      })
      .then(buf => {
        if (buf) process.stdout.write(Buffer.from(buf));
      })
      .catch(e => {
        process.stderr.write('ERROR=' + e.message);
        process.exit(1);
      });
  `

  try {
    const result = execFileSync('node', ['-e', script, exportUrl, token], {
      maxBuffer: 20 * 1024 * 1024, // 20MB
      timeout: 45000,
    })
    return Buffer.from(result)
  } catch (err: unknown) {
    const execErr = err as { stderr?: Buffer; status?: number; code?: string }
    const stderrText = execErr.stderr?.toString('utf-8').slice(0, 500) ?? 'unknown error'

    // Parse HTTP status from stderr (format: "STATUS=xxx ...")
    const statusMatch = stderrText.match(/STATUS=(\d+)/)
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : undefined

    // Propagate status code for upstream retry logic
    const exportErr = new Error(
      `Sheets PDF export failed (subprocess): gid=${sheetGid}, status=${httpStatus ?? 'unknown'}\n${stderrText}`
    ) as Error & { status?: number; code?: string }
    if (httpStatus) exportErr.status = httpStatus
    if (execErr.code === 'ETIMEDOUT') exportErr.code = 'ETIMEDOUT'
    throw exportErr
  }
}
