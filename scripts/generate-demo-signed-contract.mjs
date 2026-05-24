import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const templatePath = path.join(root, 'public', 'templates', 'labor_contract.pdf')
const demoDir = path.join(root, 'public', 'demo')
const outputPath = path.join(demoDir, 'sample-signed-contract.pdf')
const workDir = path.join(__dirname, '.demo-contract-build')
const skipRender = process.argv.includes('--skip-render')
const skipPrint = process.argv.includes('--skip-print')

const pageWidth = 595.28
const pageHeight = 841.89

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)

const gsCandidates = [
  process.env.GS_PATH,
  'C:\\Program Files\\gs\\gs10.07.0\\bin\\gswin64c.exe',
  'gswin64c',
  'gswin32c',
  'gs',
].filter(Boolean)

function findExecutable(candidates) {
  return candidates.find((candidate) => {
    if (candidate.includes('\\') || candidate.includes('/')) {
      return fs.existsSync(candidate)
    }

    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
    return result.status === 0
  })
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`)
  }
}

function pdfBoxStyle(x, y, width, height) {
  return [
    `left:${(x / pageWidth) * 100}%`,
    `top:${((pageHeight - y - height) / pageHeight) * 100}%`,
    `width:${(width / pageWidth) * 100}%`,
    `height:${(height / pageHeight) * 100}%`,
  ].join(';')
}

function toDataUri(filePath) {
  const bytes = fs.readFileSync(filePath)
  return `data:image/png;base64,${bytes.toString('base64')}`
}

function textOverlay(page, x, y, width, height, html, className = 'field') {
  return { page, html: `<div class="overlay ${className}" style="${pdfBoxStyle(x, y, width, height)}">${html}</div>` }
}

function signatureOverlay(page, x, y, width, height, className = '') {
  const signature = `
    <svg viewBox="0 0 220 70" aria-label="홍길동 서명" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 43 C42 17, 57 17, 48 42 C64 25, 76 24, 73 47 C92 28, 105 24, 104 49 C124 28, 144 17, 154 38 C162 54, 141 59, 125 52 C151 59, 181 53, 207 31" fill="none" stroke="#1f4ed8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="129" y="63" font-family="Malgun Gothic, Arial, sans-serif" font-size="14" fill="#1f4ed8">홍길동</text>
    </svg>`

  return {
    page,
    html: `<div class="overlay signature ${className}" style="${pdfBoxStyle(x, y, width, height)}">${signature}</div>`,
  }
}

function buildHtml(pageImages) {
  const overlays = [
    textOverlay(0, 232, 777, 132, 28, '근로계약서', 'title-ko'),
    textOverlay(0, 70, 430, 260, 78, [
      '<strong>문서</strong> 근로계약서 샘플',
      '<strong>근로자</strong> 홍길동',
      '<strong>연락처</strong> 010-0000-0000',
      '<strong>회사명</strong> 주식회사 데모컴퍼니',
      '<strong>계약일</strong> 2026.05.24',
    ].join('<br>')),
    textOverlay(0, 372, 720, 130, 38, 'DEMO SAMPLE<br>실제 개인정보 없음', 'stamp'),
    signatureOverlay(0, 175, 299, 62, 20),
    signatureOverlay(1, 329, 597, 62, 20),
    signatureOverlay(1, 401, 392, 62, 20),
    signatureOverlay(1, 475, 225, 62, 20),
    textOverlay(2, 338, 194, 166, 44, '2026년 05월 24일<br>근로자: 홍길동', 'field compact'),
    signatureOverlay(2, 350, 117, 160, 60, 'large'),
  ]

  const pages = pageImages.map((imagePath, index) => {
    const pageOverlays = overlays
      .filter((overlay) => overlay.page === index)
      .map((overlay) => overlay.html)
      .join('\n')

    return `
      <section class="page">
        <img class="background" src="${toDataUri(imagePath)}" alt="">
        ${pageOverlays}
      </section>`
  })

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: white; }
    .page {
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
    }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .background {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .overlay {
      position: absolute;
      z-index: 2;
      color: #111827;
      line-height: 1.45;
    }
    .field {
      padding: 5px 7px;
      border: 1px solid rgba(17, 24, 39, 0.18);
      background: rgba(255, 255, 255, 0.86);
      font-size: 10.5pt;
    }
    .field strong {
      display: inline-block;
      min-width: 46px;
      font-weight: 700;
    }
    .compact {
      font-size: 10pt;
      text-align: center;
    }
    .title-ko {
      color: white;
      font-size: 19pt;
      font-weight: 800;
      text-align: center;
      letter-spacing: 0;
    }
    .stamp {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid rgba(185, 28, 28, 0.82);
      color: rgba(185, 28, 28, 0.9);
      background: rgba(255, 255, 255, 0.6);
      font-size: 9pt;
      font-weight: 700;
      text-align: center;
      transform: rotate(-7deg);
    }
    .signature svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>${pages.join('\n')}</body>
</html>`
}

if (!fs.existsSync(templatePath)) {
  throw new Error(`Missing template: ${templatePath}`)
}

const gs = findExecutable(gsCandidates)
const chrome = findExecutable(chromeCandidates)

if (!gs) {
  throw new Error('Ghostscript is required to render the source PDF template.')
}
if (!chrome) {
  throw new Error('Chrome or Edge is required to print the demo PDF.')
}

if (!skipRender) {
  fs.rmSync(workDir, { recursive: true, force: true })
}

fs.mkdirSync(workDir, { recursive: true })
fs.mkdirSync(demoDir, { recursive: true })

const pagePattern = path.join(workDir, 'page-%d.png')
if (!skipRender) {
  run(gs, [
    '-dNOSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-sDEVICE=png16m',
    '-r144',
    `-sOutputFile=${pagePattern}`,
    templatePath,
  ])
}

const pageImages = fs.readdirSync(workDir)
  .filter((file) => /^page-\d+\.png$/.test(file))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .map((file) => path.join(workDir, file))

if (pageImages.length === 0) {
  throw new Error('No pages were rendered from the template PDF.')
}

const htmlPath = path.join(workDir, 'sample-signed-contract.html')
fs.writeFileSync(htmlPath, buildHtml(pageImages), 'utf8')

if (!skipPrint) {
  run(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--allow-file-access-from-files',
    '--virtual-time-budget=1000',
    `--print-to-pdf=${outputPath}`,
    htmlPath,
  ])

  const stats = fs.statSync(outputPath)
  fs.rmSync(workDir, { recursive: true, force: true })

  console.log(`Created ${path.relative(root, outputPath)} (${stats.size} bytes)`)
} else {
  console.log(`Created ${path.relative(root, htmlPath)}`)
}
