import { google } from 'googleapis';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_CLIENT_REFRESH_TOKEN;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

if (!clientId || !clientSecret || !refreshToken || !spreadsheetId) {
  console.error('Missing env vars');
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });

const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  const sheetName = 'TPL_labor_contract_monthly';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:K200`,
  });

  const rows = res.data.values || [];
  console.log(`Total rows fetched: ${rows.length}\n`);

  // Find rows containing 제6조 or 퇴직금
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].join(' ');
    if (rowText.includes('제6조') || rowText.includes('퇴직금')) {
      matches.push(i);
    }
  }

  console.log('=== MATCHES (제6조 / 퇴직금) ===');
  for (const idx of matches) {
    const rowNum = idx + 1; // 1-based sheet row
    console.log(`Row ${rowNum}: ${JSON.stringify(rows[idx])}`);
  }

  // Print context around each match
  console.log('\n=== CONTEXT (5 rows before/after each match) ===');
  for (const idx of matches) {
    const start = Math.max(0, idx - 5);
    const end = Math.min(rows.length - 1, idx + 5);
    console.log(`\n--- Context around row ${idx + 1} ---`);
    for (let i = start; i <= end; i++) {
      const marker = i === idx ? ' <<<' : '';
      console.log(`Row ${i + 1}: [A]=${rows[i][0] || ''} [B]=${rows[i][1] || ''}${marker}`);
    }
  }

  // Print all rows col A and B
  console.log('\n=== ALL ROWS (Column A & B) ===');
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i][0] || '';
    const b = rows[i][1] || '';
    if (a || b) {
      console.log(`Row ${i + 1}: [A]=${a} [B]=${b}`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
