import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  zonedTimeToUtc,
  combineDateAndTime,
  expandDailyRange,
  renderTemplate,
  buildTemplateParameters,
  MAX_RANGE_DAYS,
} from './templateService.js';

describe('zonedTimeToUtc', () => {
  test('reads a wall-clock time in the given zone, not the server zone', () => {
    // 09:00 IST is 03:30 UTC regardless of where this test runs.
    assert.equal(
      zonedTimeToUtc('2027-05-09T09:00', 'Asia/Kolkata')?.toISOString(),
      '2027-05-09T03:30:00.000Z'
    );
  });

  test('handles a zone ahead of and behind UTC', () => {
    assert.equal(
      zonedTimeToUtc('2027-01-15T12:00', 'UTC')?.toISOString(),
      '2027-01-15T12:00:00.000Z'
    );
    assert.equal(
      zonedTimeToUtc('2027-01-15T12:00', 'America/New_York')?.toISOString(),
      '2027-01-15T17:00:00.000Z' // EST, UTC-5
    );
  });

  test('applies the offset in force on that date, not today', () => {
    // New York is UTC-5 in January and UTC-4 in July.
    assert.equal(
      zonedTimeToUtc('2027-07-15T12:00', 'America/New_York')?.toISOString(),
      '2027-07-15T16:00:00.000Z'
    );
  });

  test('returns null for unparseable input', () => {
    assert.equal(zonedTimeToUtc('not a date', 'Asia/Kolkata'), null);
  });
});

describe('combineDateAndTime', () => {
  test('joins a date and HH:mm in the campaign zone', () => {
    assert.equal(
      combineDateAndTime('2027-11-08', '09:30', 'Asia/Kolkata')?.toISOString(),
      '2027-11-08T04:00:00.000Z'
    );
  });

  test('falls back to 10:00 when the time is malformed', () => {
    assert.equal(
      combineDateAndTime('2027-11-08', 'garbage', 'Asia/Kolkata')?.toISOString(),
      '2027-11-08T04:30:00.000Z'
    );
  });
});

describe('expandDailyRange', () => {
  test('covers an inclusive range, one send per day', () => {
    const { occurrences, error } = expandDailyRange(
      { startDate: '2027-05-09', endDate: '2027-07-15', time: '09:00' },
      'Asia/Kolkata'
    );

    assert.equal(error, undefined);
    assert.equal(occurrences.length, 68);
    assert.equal(occurrences[0].toISOString(), '2027-05-09T03:30:00.000Z');
    assert.equal(occurrences.at(-1)?.toISOString(), '2027-07-15T03:30:00.000Z');
  });

  test('spaces every send exactly 24 hours apart', () => {
    const { occurrences } = expandDailyRange(
      { startDate: '2027-05-09', endDate: '2027-05-20', time: '09:00' },
      'Asia/Kolkata'
    );

    const gaps = new Set(
      occurrences.slice(1).map((d, i) => d.getTime() - occurrences[i].getTime())
    );
    assert.deepEqual([...gaps], [86_400_000]);
  });

  test('holds the local clock time across a DST change', () => {
    // US DST begins 14 March 2027: 09:00 local is 14:00 UTC before, 13:00 after.
    const { occurrences } = expandDailyRange(
      { startDate: '2027-03-12', endDate: '2027-03-16', time: '09:00' },
      'America/New_York'
    );

    assert.equal(occurrences.length, 5);
    assert.equal(occurrences[0].toISOString(), '2027-03-12T14:00:00.000Z');
    assert.equal(occurrences.at(-1)?.toISOString(), '2027-03-16T13:00:00.000Z');
  });

  test('a single-day range yields one send', () => {
    const { occurrences } = expandDailyRange(
      { startDate: '2027-05-09', endDate: '2027-05-09', time: '09:00' },
      'Asia/Kolkata'
    );
    assert.equal(occurrences.length, 1);
  });

  test('rejects an end date before the start', () => {
    const { occurrences, error } = expandDailyRange(
      { startDate: '2027-07-15', endDate: '2027-05-09', time: '09:00' },
      'Asia/Kolkata'
    );
    assert.equal(occurrences.length, 0);
    assert.match(error ?? '', /on or after/);
  });

  test('rejects missing dates', () => {
    const { error } = expandDailyRange(
      { startDate: '', endDate: '2027-05-09', time: '09:00' },
      'Asia/Kolkata'
    );
    assert.match(error ?? '', /required/);
  });

  test('refuses a range longer than the ceiling', () => {
    const { occurrences, error } = expandDailyRange(
      { startDate: '2027-01-01', endDate: '2030-01-01', time: '09:00' },
      'Asia/Kolkata'
    );
    assert.equal(occurrences.length, 0);
    assert.match(error ?? '', new RegExp(String(MAX_RANGE_DAYS)));
  });
});

describe('renderTemplate', () => {
  const base = { timezone: 'Asia/Kolkata' };

  test('substitutes known placeholders', () => {
    assert.equal(
      renderTemplate('Hi {{name}} on {{phone}}', {
        ...base,
        name: 'Priya',
        phone: '+919876543210',
      }),
      'Hi Priya on +919876543210'
    );
  });

  test('formats dates in the campaign timezone', () => {
    assert.equal(
      renderTemplate('Born {{dob}}', { ...base, dob: new Date('1995-04-12T00:00:00Z') }),
      'Born 12 Apr 1995'
    );
  });

  test('renders sendDate, which differs per day on a range', () => {
    assert.equal(
      renderTemplate('Today is {{sendDate}}', {
        ...base,
        sendDate: new Date('2027-05-09T03:30:00Z'),
      }),
      'Today is 09 May 2027'
    );
  });

  test('leaves an unknown placeholder visible rather than blanking it', () => {
    assert.equal(renderTemplate('Hi {{nope}}', base), 'Hi {{nope}}');
  });

  test('is case and whitespace tolerant', () => {
    assert.equal(renderTemplate('Hi {{ Name }}', { ...base, name: 'Priya' }), 'Hi Priya');
  });
});

describe('buildTemplateParameters', () => {
  test('returns values in the order Meta expects', () => {
    assert.deepEqual(
      buildTemplateParameters(['name', 'eventDate'], {
        name: 'Priya Sharma',
        eventDate: new Date('2027-11-08T00:00:00Z'),
        timezone: 'Asia/Kolkata',
      }),
      ['Priya Sharma', '08 Nov 2027']
    );
  });

  test('keeps a position for a value that resolves empty', () => {
    // Meta rejects a parameter count that doesn't match the approved template,
    // so positions must never collapse.
    assert.deepEqual(
      buildTemplateParameters(['name', 'dob'], { name: 'Priya', timezone: 'Asia/Kolkata' }),
      ['Priya', '']
    );
  });

  test('returns nothing when the template takes no parameters', () => {
    assert.deepEqual(buildTemplateParameters([], { name: 'Priya' }), []);
  });
});
