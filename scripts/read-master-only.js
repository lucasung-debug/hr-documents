const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const { google } = require('googleapis');
const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
auth.setCredentials({ refresh_token: process.env.GMAIL_CLIENT_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });
const SID = process.env.GOOGLE_SPREADSHEET_ID;

function col(i) {
  let s = '';
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

sheets.spreadsheets.values.get({
  spreadsheetId: SID,
  range: "'EMPLOYEE_MASTER'!A1:Z4",
  valueRenderOption: 'FORMATTED_VALUE',
}).then(res => {
  const rows = res.data.values;
  console.log('EMPLOYEE_MASTER - Full cell dump\n');
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    console.log(`--- ROW ${rowNum} ---`);
    for (let j = 0; j < rows[i].length; j++) {
      const v = rows[i][j];
      const cellRef = col(j) + rowNum;
      console.log(`  ${cellRef.padEnd(5)} = ${JSON.stringify(v === undefined || v === null ? '' : v)}`);
    }
  }
}).catch(e => {
  console.error('ERROR:', e.message);
});
