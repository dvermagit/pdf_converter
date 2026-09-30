import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prepareManualRecipients, PrepareOptions } from './manualRecipientService.js';
import { expandDailyRange } from './templateService.js';

const AT = new Date('2027-05-09T03:30:00Z');

function options(overrides: Partial<PrepareOptions> = {}): PrepareOptions {
  return {
    timezone: 'Asia/Kolkata',
    defaultScheduledAt: AT,
    messageBody: 'Hi {{name}}',
    maxRecipients: 1000,
    ...overrides,
  };
}

describe('phone handling', () => {
  test('normalises Indian numbers to E.164', () => {
    const { recipients, errors } = prepareManualRecipients(
      [
        { name: 'A', phone: '9876543210' },
        { name: 'B', phone: '+91 98123 45678' },
        { name: 'C', phone: '09811111111' },
      ],
      options()
    );

    assert.equal(errors.length, 0);
    assert.deepEqual(
      recipients.map((r) => r.phoneNumber),
      ['+919876543210', '+919812345678', '+919811111111']
    );
  });

  test('rejects a number that is too short', () => {
    const { recipients, errors } = prepareManualRecipients(
      [{ name: 'A', phone: '123' }],
      options()
    );

    assert.equal(recipients.length, 0);
    assert.equal(errors[0].column, 'phone');
    assert.equal(errors[0].row, 1);
  });

  test('flags a duplicate inside the same batch', () => {
    const { recipients, errors } = prepareManualRecipients(
      [
        { name: 'A', phone: '9876543210' },
        { name: 'B', phone: '+919876543210' },
      ],
      options()
    );

    assert.equal(recipients.length, 1);
    assert.match(errors[0].reason, /Duplicate/);
  });

  test('flags a number already on the campaign', () => {
    const { recipients, errors } = prepareManualRecipients(
      [{ name: 'A', phone: '9876543210' }],
      options({ existingPhones: new Set(['+919876543210']) })
    );

    assert.equal(recipients.length, 0);
    assert.match(errors[0].reason, /Duplicate/);
  });

  test('reports errors against the form row the user sees', () => {
    const { errors } = prepareManualRecipients(
      [
        { name: 'A', phone: '9876543210' },
        { name: '', phone: '' },
      ],
      options()
    );

    assert.equal(errors.every((e) => e.row === 2), true);
  });
});

describe('daily range expansion', () => {
  const range = expandDailyRange(
    { startDate: '2027-05-09', endDate: '2027-07-15', time: '09:00' },
    'Asia/Kolkata'
  ).occurrences;

  test('produces one message per person per day', () => {
    const { recipients, peopleCount, messagesPerPerson } = prepareManualRecipients(
      [
        { name: 'Priya', phone: '9876543210' },
        { name: 'Rahul', phone: '9812345678' },
      ],
      options({ occurrences: range })
    );

    assert.equal(peopleCount, 2);
    assert.equal(messagesPerPerson, 68);
    assert.equal(recipients.length, 136);
  });

  test('ignores a per-person time override inside a range', () => {
    const { recipients } = prepareManualRecipients(
      [{ name: 'Priya', phone: '9876543210', scheduledAt: '2027-06-01T18:00' }],
      options({ occurrences: range })
    );

    assert.equal(recipients.length, 68);
    assert.equal(recipients[0].scheduledAt.toISOString(), range[0].toISOString());
  });

  test('renders sendDate per day', () => {
    const { recipients } = prepareManualRecipients(
      [{ name: 'Priya', phone: '9876543210' }],
      options({ occurrences: range.slice(0, 2), messageBody: 'Today is {{sendDate}}' })
    );

    assert.equal(recipients[0].message, 'Today is 09 May 2027');
    assert.equal(recipients[1].message, 'Today is 10 May 2027');
  });

  test('honours a per-person time when there is no range', () => {
    const { recipients } = prepareManualRecipients(
      [{ name: 'Priya', phone: '9876543210', scheduledAt: '2027-06-01T18:00' }],
      options()
    );

    assert.equal(recipients[0].scheduledAt.toISOString(), '2027-06-01T12:30:00.000Z');
  });
});

describe('recipient cap', () => {
  test('counts messages rather than people on a range', () => {
    const range = expandDailyRange(
      { startDate: '2027-01-01', endDate: '2027-01-10', time: '09:00' },
      'Asia/Kolkata'
    ).occurrences; // 10 days

    const { recipients, errors } = prepareManualRecipients(
      [
        { name: 'A', phone: '9876543210' },
        { name: 'B', phone: '9812345678' },
        { name: 'C', phone: '9811111111' },
      ],
      options({ occurrences: range, maxRecipients: 25 })
    );

    // 2 people × 10 days fits in 25; a third would reach 30.
    assert.equal(recipients.length, 20);
    assert.match(errors[0].reason, /30 messages \(10 per person\)/);
  });

  test('counts messages already on the campaign', () => {
    const { recipients, errors } = prepareManualRecipients(
      [{ name: 'A', phone: '9876543210' }],
      options({ maxRecipients: 5, existingMessageCount: 5 })
    );

    assert.equal(recipients.length, 0);
    assert.equal(errors.length, 1);
  });

  test('capMultiplier lets a sampled preview enforce the full expansion', () => {
    const oneDay = expandDailyRange(
      { startDate: '2027-01-01', endDate: '2027-01-01', time: '09:00' },
      'Asia/Kolkata'
    ).occurrences;

    const { errors } = prepareManualRecipients(
      [{ name: 'A', phone: '9876543210' }],
      options({ occurrences: oneDay, capMultiplier: 400, maxRecipients: 100 })
    );

    assert.match(errors[0].reason, /400 messages \(400 per person\)/);
  });
});

describe('meta template parameters', () => {
  test('resolves positional parameters per recipient', () => {
    const { recipients } = prepareManualRecipients(
      [{ name: 'Priya Sharma', phone: '9876543210' }],
      options({
        metaBodyParameters: ['name', 'eventDate'],
        eventDate: new Date('2027-11-08T00:00:00Z'),
      })
    );

    assert.deepEqual(recipients[0].templateParams, ['Priya Sharma', '08 Nov 2027']);
  });

  test('leaves parameters empty for a free-form campaign', () => {
    const { recipients } = prepareManualRecipients(
      [{ name: 'Priya', phone: '9876543210' }],
      options()
    );

    assert.deepEqual(recipients[0].templateParams, []);
  });
});
