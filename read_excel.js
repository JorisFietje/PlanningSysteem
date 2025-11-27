const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'Infuus duur 21-11-2025.xlsx');
try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(JSON.stringify(data, null, 2));
} catch (error) {
    console.error('Error reading file:', error);
}
