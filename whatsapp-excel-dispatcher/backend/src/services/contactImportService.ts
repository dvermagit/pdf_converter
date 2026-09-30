import ExcelJS from 'exceljs';
import { logger } from '../utils/logger.js';

/**
 * Pulls a contact list out of a spreadsheet for the manual campaign form.
 *
 * The sheet can be laid out any way round: this picks out only the columns it
 * needs — name, phone, date of birth and a per-person send time — and ignores
 * everything else. Columns are found by header name first, and by what the
 * cells actually contain when the headers are unhelpful or missing entirely.
 *
 * Values come back as raw strings. Phone normalisation, duplicate detection and
 * message rendering stay with the normal create/preview path so there is one
 * set of validation rules, not two.
 */

export interface ImportedContact {
  name: string;
  phone: string;
  dateOfBirth: string; // "YYYY-MM-DD", or '' when absent/unreadable
  scheduledAt: string; // "YYYY-MM-DDTHH:mm", or '' when the sheet has no time
}

export interface ContactColumnMapping {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  scheduledAt?: string;
}

export interface ImportResult {
  contacts: ImportedContact[];
  headers: string[];
  detected: ContactColumnMapping;
  /** True when a column was identified from its cell contents, not its header. */
  detectedByContent: boolean;
  /** Rows skipped because both name and phone were blank. */
  skippedRows: number;
  truncated: boolean;
  error?: string;
}

const NAME_HEADERS = [
  'name',
  'full name',
  'fullname',
  'recipient name',
  'recipient',
  'contact name',
  'customer name',
  'employee name',
  'client name',
  'person',
];

const PHONE_HEADERS = [
  'phone number',
  'phone',
  'mobile number',
  'mobile no',
  'mobile',
  'whatsapp number',
  'whatsapp',
  'contact number',
  'contact no',
  'contact',
  'number',
  'msisdn',
  'cell',
];

const DOB_HEADERS = ['date of birth', 'dob', 'birth date', 'birthdate', 'birthday', 'born'];

const SCHEDULE_HEADERS = [
  'scheduled at',
  'scheduled time',
  'schedule time',
  'schedule',
  'send time',
  'send at',
  'send date',
  'delivery time',
  'date and time',
  'date time',
  'datetime',
  'when',
];

/** How many data rows to inspect when guessing a column from its contents. */
const SAMPLE_SIZE = 25;

/** Lowercase, strip punctuation and collapse spaces so "Phone_No." matches "phone no". */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[._\-#()/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchHeader(headers: string[], candidates: string[], taken: string[]): string | undefined {
  const available = headers.filter((h) => !taken.includes(h));
  const normalized = available.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  for (const candidate of candidates) {
    const exact = normalized.find((h) => h.norm === candidate);
    if (exact) return exact.raw;
  }

  // Then a looser match, so "Employee Mobile Number" still lands on phone.
  for (const candidate of candidates) {
    const partial = normalized.find((h) => h.norm.includes(candidate));
    if (partial) return partial.raw;
  }

  return undefined;
}

function getCellString(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'text' in val) return String((val as { text: string }).text).trim();
  if (typeof val === 'object' && 'result' in val) {
    return String((val as { result: unknown }).result).trim();
  }
  if (typeof val === 'object' && 'richText' in val) {
    return (val as { richText: Array<{ text: string }> }).richText
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return String(val).trim();
}

/** A phone cell held as a number must not come back as "9.87654e+9". */
function toPhoneString(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (typeof val === 'number' && Number.isFinite(val)) return String(BigInt(Math.round(val)));
  return getCellString(cell);
}

interface ParsedDate {
  date: Date;
  hasTime: boolean;
}

/** Read a cell as a date, whatever form it is stored in. */
function parseDateCell(cell: ExcelJS.Cell): ParsedDate | null {
  const val = cell.value;
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    const hasTime = val.getUTCHours() !== 0 || val.getUTCMinutes() !== 0;
    return { date: val, hasTime };
  }

  if (typeof val === 'number') {
    // Excel serial date (days since 1899-12-30); a fractional part is a time.
    if (val < 1 || val > 2958465) return null;
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return { date, hasTime: Math.abs(val % 1) > 1e-9 };
  }

  const text = getCellString(cell);
  if (!text) return null;

  const hasTime = /\d{1,2}:\d{2}/.test(text);

  // A date written in a sheet is a wall-clock value with no timezone attached:
  // "15/08/1990" means that calendar day and "09:30" means that clock time.
  // Everything below is therefore anchored to UTC, so the value read back out
  // is the one that was typed. Which timezone it *means* is decided later, from
  // the campaign's timezone.
  const utc = (
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0
  ): ParsedDate | null => {
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
    return isNaN(date.getTime()) ? null : { date, hasTime };
  };

  // ISO-ish: 2027-05-09, 2027-05-09 07:45, 2027-05-09T07:45
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch;
    return utc(Number(y), Number(m), Number(d), Number(hh || 0), Number(mm || 0));
  }

  // DD/MM/YYYY or DD-MM-YYYY, optionally followed by a time
  const match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, d, m, y, hh, mm] = match;
    const year = y.length === 2 ? Number(`20${y}`) : Number(y);
    return utc(year, Number(m), Number(d), Number(hh || 0), Number(mm || 0));
  }

  // Last resort for formats like "12 April 1995"; read back in UTC terms so it
  // cannot drift a day either.
  const loose = new Date(text);
  if (isNaN(loose.getTime())) return null;
  return utc(
    loose.getFullYear(),
    loose.getMonth() + 1,
    loose.getDate(),
    loose.getHours(),
    loose.getMinutes()
  );
}

function toDateValue(cell: ExcelJS.Cell): string {
  const parsed = parseDateCell(cell);
  return parsed ? parsed.date.toISOString().slice(0, 10) : '';
}

/** Format for a `datetime-local` input, in the sheet's own clock terms. */
function toDateTimeValue(cell: ExcelJS.Cell): string {
  const parsed = parseDateCell(cell);
  if (!parsed) return '';
  const iso = parsed.date.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 16)}`;
}

// ── Content-based detection, for sheets whose headers say nothing useful ──

function looksLikePhone(text: string): boolean {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function looksLikeName(text: string): boolean {
  const letters = (text.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  return letters >= 2 && letters > digits;
}

interface ColumnSample {
  header: string;
  column: number;
  values: ExcelJS.Cell[];
}

function ratio(cells: ExcelJS.Cell[], test: (cell: ExcelJS.Cell) => boolean): number {
  const nonEmpty = cells.filter((c) => getCellString(c) !== '');
  if (nonEmpty.length === 0) return 0;
  return nonEmpty.filter(test).length / nonEmpty.length;
}

/**
 * Guess which column holds what, from the values themselves. Birthdays are told
 * apart from send times by age: a date years in the past is a birthday, one
 * that is recent, in the future, or carries a clock time is a schedule.
 */
function detectByContent(
  samples: ColumnSample[],
  taken: string[]
): Partial<ContactColumnMapping> {
  const free = samples.filter((s) => !taken.includes(s.header));
  const found: Partial<ContactColumnMapping> = {};
  const claimed: string[] = [];

  const pick = (
    score: (sample: ColumnSample) => number,
    minimum = 0.6
  ): ColumnSample | undefined => {
    const ranked = free
      .filter((s) => !claimed.includes(s.header))
      .map((s) => ({ sample: s, value: score(s) }))
      .filter((s) => s.value >= minimum)
      .sort((a, b) => b.value - a.value);
    return ranked[0]?.sample;
  };

  const phone = pick((s) => ratio(s.values, (c) => looksLikePhone(toPhoneString(c))));
  if (phone) {
    found.phone = phone.header;
    claimed.push(phone.header);
  }

  const name = pick((s) => ratio(s.values, (c) => looksLikeName(getCellString(c))));
  if (name) {
    found.name = name.header;
    claimed.push(name.header);
  }

  const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;

  const dob = pick((s) =>
    ratio(s.values, (c) => {
      const parsed = parseDateCell(c);
      return Boolean(parsed && !parsed.hasTime && parsed.date.getTime() < fiveYearsAgo);
    })
  );
  if (dob) {
    found.dateOfBirth = dob.header;
    claimed.push(dob.header);
  }

  const schedule = pick((s) =>
    ratio(s.values, (c) => {
      const parsed = parseDateCell(c);
      return Boolean(parsed && (parsed.hasTime || parsed.date.getTime() >= fiveYearsAgo));
    })
  );
  if (schedule) {
    found.scheduledAt = schedule.header;
    claimed.push(schedule.header);
  }

  return found;
}

/**
 * Find the header row. Sheets often carry a title or blank lines above the real
 * headers, and some have no header row at all — in that case the columns are
 * given placeholder names and every row is treated as data.
 */
function findHeaderRow(worksheet: ExcelJS.Worksheet): { rowNumber: number; isHeader: boolean } {
  const limit = Math.min(worksheet.rowCount, 10);

  for (let rowNumber = 1; rowNumber <= limit; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const cells: ExcelJS.Cell[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => cells.push(cell));

    if (cells.length < 2) continue;

    const texts = cells.map((c) => getCellString(c)).filter(Boolean);
    if (texts.length < 2) continue;

    // A row holding a phone number or a date is data, not headers.
    const looksLikeData = cells.some(
      (c) => looksLikePhone(toPhoneString(c)) || parseDateCell(c) !== null
    );

    return { rowNumber, isHeader: !looksLikeData };
  }

  return { rowNumber: 1, isHeader: false };
}

export async function importContactsFromExcel(
  buffer: Buffer,
  overrides: ContactColumnMapping,
  maxContacts: number
): Promise<ImportResult> {
  const empty: ImportResult = {
    contacts: [],
    headers: [],
    detected: {},
    detectedByContent: false,
    skippedRows: 0,
    truncated: false,
  };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return { ...empty, error: 'This file has no worksheets' };

  const { rowNumber: headerRowNumber, isHeader } = findHeaderRow(worksheet);

  // Column index → the name shown in the UI (the real header, or a placeholder).
  const headersByColumn: Record<number, string> = {};
  const headerRow = worksheet.getRow(headerRowNumber);

  if (isHeader) {
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellString(cell);
      if (text) headersByColumn[colNumber] = text;
    });
  } else {
    headerRow.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
      headersByColumn[colNumber] = `Column ${String.fromCharCode(64 + colNumber)}`;
    });
  }

  const headers = Object.values(headersByColumn);
  if (headers.length === 0) return { ...empty, error: 'This sheet appears to be empty' };

  const firstDataRow = isHeader ? headerRowNumber + 1 : headerRowNumber;

  // Sample the data for content-based detection.
  const samples: ColumnSample[] = Object.entries(headersByColumn).map(([col, header]) => ({
    header,
    column: Number(col),
    values: [],
  }));

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < firstDataRow) return;
    if (samples[0]?.values.length >= SAMPLE_SIZE) return;
    for (const sample of samples) sample.values.push(row.getCell(sample.column));
  });

  // Headers win; content fills whatever they left unidentified.
  const taken: string[] = [];
  const claim = (header?: string) => {
    if (header) taken.push(header);
    return header;
  };

  const byHeader: ContactColumnMapping = isHeader
    ? {
        name: claim(overrides.name || matchHeader(headers, NAME_HEADERS, taken)),
        phone: claim(overrides.phone || matchHeader(headers, PHONE_HEADERS, taken)),
        dateOfBirth: claim(overrides.dateOfBirth || matchHeader(headers, DOB_HEADERS, taken)),
        scheduledAt: claim(overrides.scheduledAt || matchHeader(headers, SCHEDULE_HEADERS, taken)),
      }
    : {
        name: claim(overrides.name),
        phone: claim(overrides.phone),
        dateOfBirth: claim(overrides.dateOfBirth),
        scheduledAt: claim(overrides.scheduledAt),
      };

  const needsContent = !byHeader.phone || !byHeader.name;
  const byContent = needsContent ? detectByContent(samples, taken) : {};

  const detected: ContactColumnMapping = {
    name: byHeader.name ?? byContent.name,
    phone: byHeader.phone ?? byContent.phone,
    dateOfBirth: byHeader.dateOfBirth ?? byContent.dateOfBirth,
    scheduledAt: byHeader.scheduledAt ?? byContent.scheduledAt,
  };

  const detectedByContent = Object.entries(byContent).some(
    ([key, value]) => value && detected[key as keyof ContactColumnMapping] === value
  );

  if (!detected.phone) {
    return {
      ...empty,
      headers,
      detected,
      error: 'Could not find a phone number column — pick the right column below',
    };
  }

  const columnOf = (header?: string): number | undefined => {
    if (!header) return undefined;
    const entry = Object.entries(headersByColumn).find(
      ([, name]) => name.toLowerCase() === header.toLowerCase()
    );
    return entry ? Number(entry[0]) : undefined;
  };

  const nameCol = columnOf(detected.name);
  const phoneCol = columnOf(detected.phone);
  const dobCol = columnOf(detected.dateOfBirth);
  const scheduleCol = columnOf(detected.scheduledAt);

  if (!phoneCol) {
    return { ...empty, headers, detected, error: `Column "${detected.phone}" is not in this sheet` };
  }

  const contacts: ImportedContact[] = [];
  let skippedRows = 0;
  let truncated = false;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < firstDataRow) return;
    if (contacts.length >= maxContacts) {
      truncated = true;
      return;
    }

    const name = nameCol ? getCellString(row.getCell(nameCol)) : '';
    const phone = toPhoneString(row.getCell(phoneCol));
    const dateOfBirth = dobCol ? toDateValue(row.getCell(dobCol)) : '';
    const scheduledAt = scheduleCol ? toDateTimeValue(row.getCell(scheduleCol)) : '';

    if (!name && !phone) {
      skippedRows++;
      return;
    }

    contacts.push({ name, phone, dateOfBirth, scheduledAt });
  });

  logger.info(
    { imported: contacts.length, skippedRows, truncated, detected, detectedByContent },
    'Contacts imported from Excel'
  );

  return { contacts, headers, detected, detectedByContent, skippedRows, truncated };
}
