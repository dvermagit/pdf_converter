import ExcelJS from 'exceljs';
import path from 'path';
import { logger } from '../utils/logger.js';

interface RecipientData {
  recipientName: string;
  phoneNumber: string;
  dateOfBirth?: Date;
  message: string;
  extraColumns?: Record<string, unknown>;
}

// Sanitize filename by removing unsafe characters
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

export async function generateRecipientExcel(
  recipient: RecipientData,
  campaignName: string,
  selectedColumns: string[],
  outputDir: string,
  columnMapping?: Record<string, string>
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WhatsApp Excel Dispatcher';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Recipient Data');

  // Define default columns
  const defaultColumns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Mobile Number', key: 'phone', width: 20 },
    { header: 'Date of Birth', key: 'dob', width: 15 },
    { header: 'Message', key: 'message', width: 50 },
  ];

  // Identify mapped headers that correspond to the default columns so we don't duplicate them
  const mappedDefaultHeaders = columnMapping 
    ? [
        columnMapping.recipientName,
        columnMapping.phoneNumber,
        columnMapping.dateOfBirth,
        columnMapping.message
      ].filter(Boolean)
    : [];

  // Add extra selected columns, filtering out the ones that are already in default columns
  const extraCols = selectedColumns
    .filter((col) => !mappedDefaultHeaders.includes(col))
    .map((col) => ({
      header: col,
      key: col,
      width: 20,
    }));

  worksheet.columns = [...defaultColumns, ...extraCols];

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF25D366' }, // WhatsApp green
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 30;

  // Add recipient data row
  const rowData: Record<string, unknown> = {
    name: recipient.recipientName,
    phone: recipient.phoneNumber,
    dob: recipient.dateOfBirth
      ? recipient.dateOfBirth.toLocaleDateString('en-IN')
      : '',
    message: recipient.message,
  };

  // Add extra column data
  if (recipient.extraColumns) {
    for (const col of selectedColumns) {
      if (recipient.extraColumns[col] !== undefined) {
        rowData[col] = recipient.extraColumns[col];
      }
    }
  }

  const dataRow = worksheet.addRow(rowData);
  dataRow.alignment = { vertical: 'middle', wrapText: true };

  // Add borders to all cells
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Generate filename
  const safeName = sanitizeFilename(recipient.recipientName);
  const safeCampaign = sanitizeFilename(campaignName);
  const timestamp = Date.now();
  const filename = `${safeCampaign}_${safeName}_${timestamp}.xlsx`;
  const filePath = path.join(outputDir, filename);

  await workbook.xlsx.writeFile(filePath);

  logger.debug({ filePath, recipient: recipient.recipientName }, 'Generated recipient Excel');

  return filePath;
}
