const fs = require('fs');
const xlsx = require('xlsx');

for (const file of fs.readdirSync('uploads').filter((name) => name.endsWith('.xlsx'))) {
  const workbook = xlsx.readFile(`uploads/${file}`);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log('FILE', file, 'ROWS', rows.length);
  console.log('HEADERS', Object.keys(rows[0] || {}));

  const statusValuesByColumn = {};
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (/status/i.test(key)) {
        statusValuesByColumn[key] ||= new Set();
        statusValuesByColumn[key].add(String(row[key]).trim());
      }
    }
  }

  for (const [key, values] of Object.entries(statusValuesByColumn)) {
    console.log(key, Array.from(values).slice(0, 30));
  }
}
