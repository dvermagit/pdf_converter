import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { importContactsFromExcel } from './contactImportService.js';

/** Build an in-memory .xlsx from rows, so tests need no fixture files. */
async function sheet(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  for (const row of rows) worksheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const MAX = 1000;

describe('column detection', () => {
  test('matches columns by header name and ignores the rest', async () => {
    const buffer = await sheet([
      ['Sr No', 'Full Name', 'City', 'Mobile Number', 'Date of Birth', 'Notes'],
      [1, 'Priya Sharma', 'Pune', 9876543210, '12/04/1995', 'vip'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);

    assert.equal(result.detected.name, 'Full Name');
    assert.equal(result.detected.phone, 'Mobile Number');
    assert.equal(result.detected.dateOfBirth, 'Date of Birth');
    assert.equal(result.contacts.length, 1);
  });

  test('matches header variants and partial names', async () => {
    const buffer = await sheet([
      ['Employee Name', 'Contact No.', 'Birthday', 'Send Time'],
      ['Rahul Verma', '9812345678', '15/08/1990', '09/05/2027 18:00'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);

    assert.equal(result.detected.name, 'Employee Name');
    assert.equal(result.detected.phone, 'Contact No.');
    assert.equal(result.detected.dateOfBirth, 'Birthday');
    assert.equal(result.detected.scheduledAt, 'Send Time');
  });

  test('finds the header row beneath title rows', async () => {
    const buffer = await sheet([
      ['ACME Corp — Contact List'],
      [],
      ['Name', 'WhatsApp', 'DOB'],
      ['Meera Iyer', '9822222222', '01/01/1988'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);

    assert.equal(result.detected.phone, 'WhatsApp');
    assert.equal(result.contacts.length, 1);
    assert.equal(result.contacts[0].name, 'Meera Iyer');
  });

  test('falls back to cell contents when headers say nothing', async () => {
    const buffer = await sheet([
      ['A', 'B', 'C', 'D'],
      ['X1', 'Kavita Nair', '9844444444', '11/11/1985'],
      ['X2', 'Arjun Mehta', '9855555555', '12/12/1986'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);

    assert.equal(result.detectedByContent, true);
    assert.equal(result.detected.phone, 'C');
    assert.equal(result.detected.name, 'B');
    assert.equal(result.contacts.length, 2);
  });

  test('handles a sheet with no header row at all', async () => {
    const buffer = await sheet([
      ['Rohit Kale', '9877777777', '14/02/1989'],
      ['Sneha Joshi', '9888888888', '15/03/1991'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);

    assert.equal(result.contacts.length, 2);
    assert.equal(result.contacts[0].name, 'Rohit Kale');
    assert.equal(result.contacts[0].phone, '9877777777');
  });

  test('honours explicit column overrides', async () => {
    const buffer = await sheet([
      ['A', 'B', 'C'],
      ['Meera Iyer', '9822222222', '01/01/1988'],
    ]);

    const result = await importContactsFromExcel(
      buffer,
      { name: 'A', phone: 'B', dateOfBirth: 'C' },
      MAX
    );

    assert.equal(result.contacts[0].name, 'Meera Iyer');
    assert.equal(result.contacts[0].dateOfBirth, '1988-01-01');
  });

  test('reports the headers when no phone column can be found', async () => {
    const buffer = await sheet([
      ['Title', 'Comment'],
      ['Mr', 'hello'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);

    assert.match(result.error ?? '', /phone/i);
    assert.deepEqual(result.headers, ['Title', 'Comment']);
  });
});

describe('cell values', () => {
  // These are regressions: naive parsing shifted every value by a day or by the
  // server's UTC offset, which is silent and corrupts real campaigns.
  test('keeps a DD/MM/YYYY birthday on its own calendar day', async () => {
    const buffer = await sheet([
      ['Name', 'Phone', 'DOB'],
      ['Rahul Verma', '9812345678', '15/08/1990'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].dateOfBirth, '1990-08-15');
  });

  test('keeps a send time at the clock time written in the sheet', async () => {
    const buffer = await sheet([
      ['Name', 'Phone', 'Scheduled At'],
      ['Priya Sharma', '9876543210', '09/05/2027 09:30'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].scheduledAt, '2027-05-09T09:30');
  });

  test('reads ISO dates with and without a time', async () => {
    const buffer = await sheet([
      ['Name', 'Phone', 'DOB', 'Send Time'],
      ['Imran Khan', '9899999999', '1993-06-20', '2027-05-09 07:45'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].dateOfBirth, '1993-06-20');
    assert.equal(result.contacts[0].scheduledAt, '2027-05-09T07:45');
  });

  test('reads a real Date cell and an Excel serial number', async () => {
    const buffer = await sheet([
      ['Name', 'Phone', 'DOB'],
      ['Priya Sharma', '9876543210', new Date(Date.UTC(1995, 3, 12))],
      ['Vikram Singh', '9811111111', 33000], // serial → 1990-05-07
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].dateOfBirth, '1995-04-12');
    assert.equal(result.contacts[1].dateOfBirth, '1990-05-07');
  });

  test('never renders a numeric phone in scientific notation', async () => {
    const buffer = await sheet([
      ['Name', 'Phone'],
      ['Priya Sharma', 9876543210],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].phone, '9876543210');
  });

  test('preserves a leading zero and spaced E.164 formatting', async () => {
    const buffer = await sheet([
      ['Name', 'Phone'],
      ['Anita Rao', '09900112233'],
      ['Rahul Verma', '+91 98123 45678'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].phone, '09900112233');
    assert.equal(result.contacts[1].phone, '+91 98123 45678');
  });

  test('leaves an unreadable date blank rather than guessing', async () => {
    const buffer = await sheet([
      ['Name', 'Phone', 'DOB'],
      ['Test User', '9876500000', 'not a date'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts[0].dateOfBirth, '');
  });
});

describe('rows', () => {
  test('skips rows with neither a name nor a number', async () => {
    const buffer = await sheet([
      ['Name', 'Phone'],
      ['Priya Sharma', '9876543210'],
      ['', ''],
      ['Rahul Verma', '9812345678'],
    ]);

    const result = await importContactsFromExcel(buffer, {}, MAX);
    assert.equal(result.contacts.length, 2);
    assert.equal(result.skippedRows, 1);
  });

  test('stops at the cap and says so', async () => {
    const rows: unknown[][] = [['Name', 'Phone']];
    for (let i = 0; i < 10; i++) rows.push([`Person ${i}`, `98765000${String(i).padStart(2, '0')}`]);

    const result = await importContactsFromExcel(await sheet(rows), {}, 4);

    assert.equal(result.contacts.length, 4);
    assert.equal(result.truncated, true);
  });
});
