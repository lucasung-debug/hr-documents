import { google } from 'googleapis';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_CLIENT_REFRESH_TOKEN;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

if (!clientId || !clientSecret || !refreshToken || !spreadsheetId) {
  console.error('Missing env vars. Make sure to run: export $(grep -v "^#" .env.local | xargs)');
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });

const sheets = google.sheets({ version: 'v4', auth });

const TARGET_SHEETS = [
  'TPL_labor_contract_monthly',
  'TPL_labor_contract_daily',
];

async function main() {
  // Step 1: Get spreadsheet metadata to find sheetIds
  console.log('=== Step 1: Fetching spreadsheet metadata ===\n');
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const allSheets = meta.data.sheets || [];
  const sheetMap = {};

  for (const s of allSheets) {
    const name = s.properties.title;
    const id = s.properties.sheetId;
    if (TARGET_SHEETS.includes(name)) {
      sheetMap[name] = { sheetId: id, properties: s.properties };
      console.log(`Found: "${name}" => sheetId=${id}`);
    }
  }

  const missing = TARGET_SHEETS.filter(n => !sheetMap[n]);
  if (missing.length > 0) {
    console.error(`\nWARNING: These sheets were not found: ${missing.join(', ')}`);
  }

  // Step 2: Read data and find 제6조 row in each sheet
  console.log('\n=== Step 2: Finding "제6조" rows ===\n');

  const results = [];

  for (const sheetName of Object.keys(sheetMap)) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:K300`,
    });

    const rows = res.data.values || [];
    console.log(`"${sheetName}": ${rows.length} rows fetched`);

    let found = false;
    for (let i = 0; i < rows.length; i++) {
      const rowText = rows[i].join(' ');
      if (rowText.includes('제6조')) {
        const rowNum = i + 1; // 1-based
        const rowIndex = i;   // 0-based (for API)
        console.log(`  => "제6조" found at Row ${rowNum} (0-based index: ${rowIndex})`);
        console.log(`     Content: ${rows[i].slice(0, 5).join(' | ')}`);

        // Show context
        const start = Math.max(0, i - 2);
        const end = Math.min(rows.length - 1, i + 2);
        console.log(`     Context:`);
        for (let j = start; j <= end; j++) {
          const marker = j === i ? ' <<<' : '';
          console.log(`       Row ${j + 1}: ${rows[j].slice(0, 3).join(' | ')}${marker}`);
        }

        results.push({
          sheetName,
          sheetId: sheetMap[sheetName].sheetId,
          rowNumber: rowNum,
          rowIndex: rowIndex,
        });
        found = true;
        break; // Take first match only
      }
    }

    if (!found) {
      console.log(`  => "제6조" NOT found in "${sheetName}"`);
    }
  }

  if (results.length === 0) {
    console.log('\nNo 제6조 rows found. Exiting.');
    return;
  }

  // Step 3: Attempt to set page breaks via Sheets API
  console.log('\n=== Step 3: Attempting page break via Sheets API ===\n');

  // Approach: Try updateSheetProperties with pageBreaks in gridProperties
  // The Sheets API v4 does NOT officially support manual page breaks.
  // But let's try a few approaches to confirm.

  for (const r of results) {
    console.log(`\nAttempting page break for "${r.sheetName}" (sheetId=${r.sheetId}) before row ${r.rowNumber}...`);

    // Attempt 1: Try using updateDimensionProperties to set a large pixelSize
    // on the row BEFORE 제6조 to potentially force a page break
    // This is a workaround, not a real page break.

    // Attempt 2: Try the undocumented/less-known approach
    try {
      const batchRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: r.sheetId,
                gridProperties: {
                  rowCount: undefined, // keep existing
                },
              },
              fields: 'gridProperties',
            },
          }],
        },
      });
      console.log(`  updateSheetProperties result: OK (but likely did not set page break)`);
      console.log(`  Response: ${JSON.stringify(batchRes.data.replies)}`);
    } catch (err) {
      console.log(`  updateSheetProperties failed: ${err.message}`);
    }

    // Attempt 3: Try setting row height on the row before 제6조 to a large value
    // to push 제6조 to the next page
    try {
      // First, let's try to see if there's a pageBreakBefore in rowMetadata
      // by reading dimension properties
      const dimRes = await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [`${r.sheetName}!${r.rowIndex}:${r.rowIndex + 1}`],
        fields: 'sheets.data.rowMetadata',
      });
      console.log(`  Row metadata for row ${r.rowNumber}:`, JSON.stringify(dimRes.data.sheets?.[0]?.data?.[0]?.rowMetadata));
    } catch (err) {
      console.log(`  Reading row metadata failed: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===\n');
  console.log('Google Sheets API v4 does NOT have a direct "insert page break" method.');
  console.log('Page breaks can only be set manually through the Sheets UI:\n');
  console.log('  1. Open the spreadsheet in Google Sheets');
  console.log('  2. Go to View > Show > Page breaks (or Insert > Break > Page break)');
  console.log('  3. Drag the blue dotted line to the desired position\n');
  console.log('Findings:\n');

  for (const r of results) {
    console.log(`  Sheet: "${r.sheetName}"`);
    console.log(`    sheetId (gid): ${r.sheetId}`);
    console.log(`    "제6조" at Row: ${r.rowNumber} (0-based index: ${r.rowIndex})`);
    console.log(`    Manual page break: Set BEFORE row ${r.rowNumber} in Sheets UI`);
    console.log(`    Direct link: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${r.sheetId}`);
    console.log('');
  }

  console.log('Alternative approaches for programmatic page control:');
  console.log('  1. Insert empty rows before 제6조 to push it to a new page');
  console.log('  2. Adjust row heights above 제6조 to force natural page break');
  console.log('  3. Use PDF post-processing with pdf-lib to split pages');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  if (err.response?.data) {
    console.error('API error details:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
