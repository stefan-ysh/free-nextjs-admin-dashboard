import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  key: keyof T | string;
  title: string;
  formatter?: (value: unknown, row: T) => string;
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
) {
  const worksheetData = data.map((row) => {
    const rowData: Record<string, unknown> = {};
    for (const col of columns) {
      const keys = String(col.key).split('.');
      let value: unknown = row;
      for (const key of keys) {
        value = value?.[key as keyof typeof value];
      }
      rowData[col.title] = col.formatter ? col.formatter(value, row) : value;
    }
    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function parseExcelFile(file: File): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        resolve(json);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsBinaryString(file);
  });
}
