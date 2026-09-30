import { IValidationError } from '../models/Campaign.js';
import { normalizePhone } from './excelValidator.js';
import { renderTemplate, zonedTimeToUtc, buildTemplateParameters } from './templateService.js';

/** One row of the manual "add people" form. */
export interface ManualRecipientInput {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  /** Overrides the campaign/template message for this person only. */
  message?: string;
  /** Local wall-clock time ("2026-11-01T09:00") in the campaign timezone. */
  scheduledAt?: string;
}

export interface PreparedRecipient {
  recipientName: string;
  phoneNumber: string;
  dateOfBirth?: Date;
  message: string;
  /** Positional values for an approved Meta template; empty for free-form. */
  templateParams: string[];
  scheduledAt: Date;
}

export interface PrepareOptions {
  timezone: string;
  /** Applied to every recipient that has no time of their own. */
  defaultScheduledAt: Date;
  /**
   * A daily range expanded to one instant per day. When set, every person gets
   * one message per occurrence and per-person time overrides are ignored —
   * the whole point of a range is that everyone is on the same daily schedule.
   */
  occurrences?: Date[];
  /** Template body (or plain message) used when a recipient has no message. */
  messageBody: string;
  /**
   * Placeholder names feeding an approved Meta template's {{1}}, {{2}}, … in
   * order. Set only when the campaign sends through a Meta template.
   */
  metaBodyParameters?: string[];
  eventName?: string;
  eventDate?: Date | null;
  /** Phone numbers already on the campaign, so re-adds are flagged. */
  existingPhones?: Set<string>;
  /** Messages already scheduled on the campaign, counted against the cap. */
  existingMessageCount?: number;
  /**
   * Messages each person will ultimately receive, when that differs from
   * `occurrences.length` — the preview expands only the first day but must
   * still refuse a range whose full expansion would breach the cap.
   */
  capMultiplier?: number;
  maxRecipients: number;
}

export interface PrepareResult {
  recipients: PreparedRecipient[];
  errors: IValidationError[];
  /** Distinct people accepted (recipients.length = peopleCount × messagesPerPerson). */
  peopleCount: number;
  messagesPerPerson: number;
}

function parseDob(value?: string): Date | null | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Validate and normalise manually-entered recipients the same way the Excel
 * importer does: E.164 phone numbers, duplicate detection, a resolved message
 * and an absolute send time.
 */
export function prepareManualRecipients(
  inputs: ManualRecipientInput[],
  options: PrepareOptions
): PrepareResult {
  const recipients: PreparedRecipient[] = [];
  const errors: IValidationError[] = [];
  const seenPhones = new Set(options.existingPhones ?? []);

  const occurrences = options.occurrences?.length ? options.occurrences : null;
  const perPerson = occurrences ? occurrences.length : 1;
  const capPerPerson = options.capMultiplier ?? perPerson;
  const existingMessages = options.existingMessageCount ?? 0;
  let peopleAccepted = 0;
  let capReported = false;

  inputs.forEach((input, index) => {
    // 1-based so error messages line up with the form rows the user sees.
    const row = index + 1;

    // The cap counts messages, not people: on a daily range each person
    // accounts for one message per day in the range.
    if (existingMessages + (peopleAccepted + 1) * capPerPerson > options.maxRecipients) {
      if (!capReported) {
        capReported = true;
        errors.push({
          row,
          column: '',
          value: '',
          reason:
            capPerPerson > 1
              ? `This range would send ${(peopleAccepted + 1) * capPerPerson} messages (${capPerPerson} per person), over the ${options.maxRecipients} limit per campaign. Shorten the range or split the list.`
              : `Maximum ${options.maxRecipients} recipients per campaign exceeded`,
        });
      }
      return;
    }

    const name = (input.name || '').trim();
    if (!name) {
      errors.push({ row, column: 'name', value: '', reason: 'Recipient name is required' });
    }

    const rawPhone = (input.phone || '').trim();
    let normalizedPhone: string | null = null;

    if (!rawPhone) {
      errors.push({ row, column: 'phone', value: '', reason: 'Phone number is required' });
    } else {
      normalizedPhone = normalizePhone(rawPhone);
      if (!normalizedPhone) {
        errors.push({
          row,
          column: 'phone',
          value: rawPhone,
          reason: 'Invalid phone number. Use 10 digits or an E.164 number like +919876543210',
        });
      } else if (seenPhones.has(normalizedPhone)) {
        errors.push({
          row,
          column: 'phone',
          value: rawPhone,
          reason: `Duplicate phone number: ${normalizedPhone}`,
        });
        normalizedPhone = null;
      }
    }

    const dob = parseDob(input.dateOfBirth);
    if (dob === null) {
      errors.push({
        row,
        column: 'dateOfBirth',
        value: String(input.dateOfBirth),
        reason: 'Invalid date of birth',
      });
    }

    let scheduledAt: Date | null = options.defaultScheduledAt;
    if (input.scheduledAt && input.scheduledAt.trim()) {
      scheduledAt = zonedTimeToUtc(input.scheduledAt, options.timezone);
      if (!scheduledAt) {
        errors.push({
          row,
          column: 'scheduledAt',
          value: input.scheduledAt,
          reason: 'Invalid date/time',
        });
      }
    }

    const body = (input.message || '').trim() || options.messageBody;
    // Rendered per send, so {{sendDate}} reflects the day that copy goes out.
    const renderFor = (sendDate: Date) =>
      renderTemplate(body, {
        name,
        phone: normalizedPhone || rawPhone,
        dob: dob ?? null,
        eventName: options.eventName,
        eventDate: options.eventDate ?? null,
        sendDate,
        timezone: options.timezone,
      }).trim();

    const paramsFor = (sendDate: Date) =>
      options.metaBodyParameters?.length
        ? buildTemplateParameters(options.metaBodyParameters, {
            name,
            phone: normalizedPhone || rawPhone,
            dob: dob ?? null,
            eventName: options.eventName,
            eventDate: options.eventDate ?? null,
            sendDate,
            timezone: options.timezone,
          })
        : [];

    const message = renderFor(scheduledAt ?? options.defaultScheduledAt);

    if (!message) {
      errors.push({ row, column: 'message', value: '', reason: 'Message is required' });
    }

    if (!name || !normalizedPhone || !scheduledAt || !message) return;

    seenPhones.add(normalizedPhone);
    peopleAccepted++;

    if (occurrences) {
      for (const occurrence of occurrences) {
        recipients.push({
          recipientName: name,
          phoneNumber: normalizedPhone,
          dateOfBirth: dob ?? undefined,
          message: renderFor(occurrence),
          templateParams: paramsFor(occurrence),
          scheduledAt: occurrence,
        });
      }
      return;
    }

    recipients.push({
      recipientName: name,
      phoneNumber: normalizedPhone,
      dateOfBirth: dob ?? undefined,
      message,
      templateParams: paramsFor(scheduledAt),
      scheduledAt,
    });
  });

  return { recipients, errors, peopleCount: peopleAccepted, messagesPerPerson: perPerson };
}
