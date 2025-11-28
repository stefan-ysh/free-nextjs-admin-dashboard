import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

const QUOTE_TEMPLATE = '北京农科院报（全部）价单 20251118.xls';
const DELIVERY_TEMPLATE = '农科院发货单（全部）.xls';

function analyzeExcel(filename: string) {
    const filePath = path.join(process.cwd(), filename);
    console.log(`\nAnalyzing: ${filename}`);
    console.log('Path:', filePath);

    if (!fs.existsSync(filePath)) {
        console.error('File not found!');
        return;
    }

    const workbook = xlsx.readFile(filePath);

    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const worksheet = workbook.Sheets[sheetName];

        // Get range
        const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        console.log(`Range: ${worksheet['!ref']}`);

        // Print first 10 rows to understand structure
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        json.slice(0, 15).forEach((row, index) => {
            console.log(`Row ${index}:`, JSON.stringify(row));
        });
    });
}

console.log('Starting Template Analysis...');
analyzeExcel(QUOTE_TEMPLATE);
analyzeExcel(DELIVERY_TEMPLATE);
