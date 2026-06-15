import * as XLSX from 'xlsx';

/**
 * Normalizes Date cells in an Excel worksheet to standard YYYY-MM-DD string format.
 * This handles local timezone and historical offset discrepancies.
 */
export function normalizeExcelWorksheetDates(worksheet: XLSX.WorkSheet): void {
  for (const key in worksheet) {
    if (key[0] === '!') continue;
    const cell = worksheet[key];
    if (cell && (cell.t === 'd' || cell.v instanceof Date)) {
      const date = cell.v instanceof Date ? cell.v : new Date(cell.v);
      if (!isNaN(date.getTime())) {
        // Add 12 hours to handle local timezone / historical offset discrepancies
        const adjusted = new Date(date.getTime() + 12 * 60 * 60 * 1000);
        const yyyy = adjusted.getFullYear();
        const mm = String(adjusted.getMonth() + 1).padStart(2, '0');
        const dd = String(adjusted.getDate()).padStart(2, '0');
        const formatted = `${yyyy}-${mm}-${dd}`;
        cell.t = 's';
        cell.v = formatted;
        cell.w = formatted;
      }
    }
  }
}

/**
 * Reads an Excel (.xlsx, .xls) or CSV (.csv) file in the browser,
 * parses it, normalizes date columns, and returns the CSV content text and worksheet.
 */
export function readExcelOrCsvFile(
  file: File,
  onSuccess: (csvContent: string, worksheet: XLSX.WorkSheet) => void,
  onError: (errorMsg: string) => void
): void {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  const reader = new FileReader();

  if (isExcel) {
    reader.onload = (e) => {
      try {
        if (e.target?.result) {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          normalizeExcelWorksheetDates(worksheet);
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          onSuccess(csvContent, worksheet);
        }
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        onError('Gagal membaca file Excel. Pastikan file tidak rusak.');
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = (e) => {
      if (e.target?.result) {
        const csvTextContent = e.target.result as string;
        try {
          const workbook = XLSX.read(csvTextContent, { type: 'string' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          onSuccess(csvTextContent, worksheet);
        } catch (err) {
          console.error('Error preparing CSV preview:', err);
          onError('Gagal memproses file CSV.');
        }
      }
    };
    reader.readAsText(file);
  }
}
