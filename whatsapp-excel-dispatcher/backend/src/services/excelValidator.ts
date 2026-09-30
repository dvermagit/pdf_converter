import ExcelJS from 'exceljs';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { IValidationError } from '../models/Campaign.js';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string | number | Date | null>;
}

export interface ValidationResult {
  isValid: boolean;
  headers: string[];
  rows: ParsedRow[];
  errors: IValidationError[];
  totalRows: number;
}

// Normalize phone number to E.164 format
export function normalizePhone(phone: string): string | null {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

  // If starts with 0, assume Indian number
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }

  // If 10 digits, assume Indian number
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }

  // Must be digits only and between 10-15 chars
  if (!/^\d{10,15}$/.test(cleaned)) {
    return null;
  }

  return '+' + cleaned;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date number
    const date = new Date((value - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    let date = new Date(value);
    if (!isNaN(date.getTime())) return date;

    // Fallback for DD-MM-YYYY or DD/MM/YYYY
    const parts = value.split(/[-/]/);
    if (parts.length === 3) {
      // Format as YYYY-MM-DD for standard parsing
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

// Get cell value as string
function getCellString(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && 'text' in val) return String((val as { text: string }).text);
  if (typeof val === 'object' && 'result' in val) return String((val as { result: unknown }).result);
  return String(val).trim();
}

export async function validateExcel(
  filePath: string,
  columnMapping: Record<string, string>
): Promise<ValidationResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    return {
      isValid: false,
      headers: [],
      rows: [],
      errors: [{ row: 0, column: '', value: '', reason: 'Workbook contains no worksheets' }],
      totalRows: 0,
    };
  }

  // Read headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = getCellString(cell);
  });

  if (headers.filter(Boolean).length === 0) {
    return {
      isValid: false,
      headers: [],
      rows: [],
      errors: [{ row: 1, column: '', value: '', reason: 'No headers found in first row' }],
      totalRows: 0,
    };
  }

  const errors: IValidationError[] = [];
  const rows: ParsedRow[] = [];
  const seenPhones = new Set<string>();
  let totalRows = 0;

  // Find column indices from mapping
  const colIndices: Record<string, number> = {};
  for (const [field, headerName] of Object.entries(columnMapping)) {
    const idx = headers.findIndex(
      (h) => h && h.toLowerCase().trim() === headerName.toLowerCase().trim()
    );
    if (idx === -1) {
      errors.push({
        row: 0,
        column: headerName,
        value: '',
        reason: `Mapped column "${headerName}" not found in Excel headers`,
      });
    } else {
      colIndices[field] = idx;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, headers: headers.filter(Boolean), rows: [], errors, totalRows: 0 };
  }

  // Validate each data row
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    totalRows++;

    if (totalRows > env.MAX_RECIPIENTS_PER_CAMPAIGN) {
      if (totalRows === env.MAX_RECIPIENTS_PER_CAMPAIGN + 1) {
        errors.push({
          row: rowNumber,
          column: '',
          value: '',
          reason: `Maximum ${env.MAX_RECIPIENTS_PER_CAMPAIGN} recipients per campaign exceeded`,
        });
      }
      return;
    }

    const rowData: Record<string, string | number | Date | null> = {};

    // Extract all columns
    headers.forEach((header, colIdx) => {
      if (header) {
        rowData[header] = getCellString(row.getCell(colIdx));
      }
    });

    // Validate required fields
    // Name
    if (colIndices.recipientName !== undefined) {
      const name = getCellString(row.getCell(colIndices.recipientName));
      if (!name) {
        errors.push({
          row: rowNumber,
          column: columnMapping.recipientName,
          value: '',
          reason: 'Recipient name is required',
        });
      }
    }

    // Phone number
    if (colIndices.phoneNumber !== undefined) {
      const rawPhone = getCellString(row.getCell(colIndices.phoneNumber));
      if (!rawPhone) {
        errors.push({
          row: rowNumber,
          column: columnMapping.phoneNumber,
          value: '',
          reason: 'Phone number is required',
        });
      } else {
        const normalized = normalizePhone(rawPhone);
        if (!normalized) {
          errors.push({
            row: rowNumber,
            column: columnMapping.phoneNumber,
            value: rawPhone,
            reason: 'Invalid phone number format. Expected E.164 format (e.g., +919876543210)',
          });
        } else if (seenPhones.has(normalized)) {
          errors.push({
            row: rowNumber,
            column: columnMapping.phoneNumber,
            value: rawPhone,
            reason: `Duplicate phone number: ${normalized}`,
          });
        } else {
          seenPhones.add(normalized);
          rowData['__normalizedPhone'] = normalized;
        }
      }
    }

    // Message
    if (colIndices.message !== undefined) {
      const msg = getCellString(row.getCell(colIndices.message));
      if (!msg) {
        errors.push({
          row: rowNumber,
          column: columnMapping.message,
          value: '',
          reason: 'Message is required',
        });
      }
    }

    // Scheduled time
    if (colIndices.scheduledAt !== undefined) {
      const rawTime = row.getCell(colIndices.scheduledAt).value;
      const parsed = parseDate(rawTime);
      if (!parsed) {
        errors.push({
          row: rowNumber,
          column: columnMapping.scheduledAt,
          value: String(rawTime || ''),
          reason: 'Invalid date/time format',
        });
      } else {
        rowData['__parsedScheduledAt'] = parsed;
      }
    }

    // Date of birth (optional but validate if mapped)
    if (colIndices.dateOfBirth !== undefined) {
      const rawDob = row.getCell(colIndices.dateOfBirth).value;
      if (rawDob) {
        const parsed = parseDate(rawDob);
        if (!parsed) {
          errors.push({
            row: rowNumber,
            column: columnMapping.dateOfBirth,
            value: String(rawDob),
            reason: 'Invalid date of birth format',
          });
        } else {
          rowData['__parsedDob'] = parsed;
        }
      }
    }

    rows.push({ rowNumber, data: rowData });
  });

  const isValid = errors.length === 0;

  logger.info(
    {
      filePath,
      totalRows,
      validRows: rows.length,
      errorCount: errors.length,
    },
    'Excel validation complete'
  );

  return {
    isValid,
    headers: headers.filter(Boolean),
    rows,
    errors,
    totalRows,
  };
}

export function getPreviewRows(rows: ParsedRow[], count: number = 10): ParsedRow[] {
  return rows.slice(0, count);
}
