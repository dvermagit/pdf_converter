/**
 * Campaign templates: ready-made festival/event presets, placeholder rendering,
 * and timezone-aware conversion of "local wall clock time" to a UTC instant.
 */

export interface TemplatePreset {
  key: string;
  name: string;
  occasion: string;
  emoji: string;
  description: string;
  messageBody: string;
  defaultSendTime: string;
}

/** Starter templates offered in the UI — the user can edit anything after creating. */
export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    key: 'diwali',
    name: 'Diwali Greetings',
    occasion: 'Diwali',
    emoji: '🪔',
    description: 'Festival of lights wishes with a personalised greeting.',
    messageBody:
      'Hi {{name}} 🪔\n\nWishing you and your family a very Happy Diwali! May this festival of lights bring joy, prosperity and good health your way.\n\nWarm regards,\nTeam',
    defaultSendTime: '09:00',
  },
  {
    key: 'holi',
    name: 'Holi Wishes',
    occasion: 'Holi',
    emoji: '🎨',
    description: 'Colourful Holi greeting for your contact list.',
    messageBody:
      'Hi {{name}} 🎨\n\nHappy Holi! May your life be as colourful and joyful as the festival itself.\n\nWarm regards,\nTeam',
    defaultSendTime: '10:00',
  },
  {
    key: 'new_year',
    name: 'New Year Wishes',
    occasion: 'New Year',
    emoji: '🎆',
    description: 'New Year greeting to kick off the year.',
    messageBody:
      'Hi {{name}} 🎆\n\nHappy New Year! Thank you for being with us this year — here is to an even better {{eventDate}}.\n\nWarm regards,\nTeam',
    defaultSendTime: '00:05',
  },
  {
    key: 'birthday',
    name: 'Birthday Greeting',
    occasion: 'Birthday',
    emoji: '🎂',
    description: 'Personalised birthday message using each contact’s date of birth.',
    messageBody:
      'Happy Birthday {{name}}! 🎂\n\nWishing you a wonderful year ahead filled with health and happiness.\n\nWarm regards,\nTeam',
    defaultSendTime: '09:00',
  },
  {
    key: 'event_invite',
    name: 'Event Invitation',
    occasion: 'Event',
    emoji: '📅',
    description: 'Invite contacts to an event on a specific date.',
    messageBody:
      'Hi {{name}} 📅\n\nYou are invited to {{eventName}} on {{eventDate}}. We would love to see you there!\n\nPlease reply to confirm your attendance.\n\nWarm regards,\nTeam',
    defaultSendTime: '11:00',
  },
  {
    key: 'custom',
    name: 'Blank Template',
    occasion: 'custom',
    emoji: '✏️',
    description: 'Start from scratch and write your own message.',
    messageBody: 'Hi {{name}},\n\n',
    defaultSendTime: '10:00',
  },
];

export interface PlaceholderValues {
  name?: string;
  phone?: string;
  dob?: Date | null;
  eventName?: string;
  eventDate?: Date | null;
  /** The day this particular copy goes out — differs per day on a daily range. */
  sendDate?: Date | null;
  timezone?: string;
}

/** Placeholders a template message may contain, shown as hints in the editor. */
export const SUPPORTED_PLACEHOLDERS = [
  '{{name}}',
  '{{phone}}',
  '{{dob}}',
  '{{eventName}}',
  '{{eventDate}}',
  '{{sendDate}}',
];

function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Resolve every placeholder to its value for one recipient, keyed by lowercase
 * name. Shared by our own `{{name}}` rendering and by the positional parameter
 * list Meta's approved templates require.
 */
export function resolvePlaceholderValues(values: PlaceholderValues): Record<string, string> {
  const timezone = values.timezone || 'Asia/Kolkata';

  return {
    name: values.name || '',
    phone: values.phone || '',
    dob: values.dob ? formatDate(values.dob, timezone) : '',
    eventname: values.eventName || '',
    eventdate: values.eventDate ? formatDate(values.eventDate, timezone) : '',
    senddate: values.sendDate ? formatDate(values.sendDate, timezone) : '',
  };
}

/**
 * Replace {{placeholders}} in a template body. Unknown placeholders are left
 * untouched so a typo is visible in the preview rather than silently dropped.
 */
export function renderTemplate(body: string, values: PlaceholderValues): string {
  const replacements = resolvePlaceholderValues(values);

  return body.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, key: string) => {
    const value = replacements[key.toLowerCase()];
    return value !== undefined ? value : match;
  });
}

/**
 * Build the ordered parameter list for an approved Meta template.
 *
 * Meta uses positional variables ({{1}}, {{2}}) rather than names, so a template
 * records which of our placeholders feeds each position. A value that resolves
 * empty is still sent as an empty string — Meta rejects a parameter count that
 * doesn't match the approved template, so positions must never be dropped.
 */
export function buildTemplateParameters(
  parameterNames: string[],
  values: PlaceholderValues
): string[] {
  const resolved = resolvePlaceholderValues(values);
  return parameterNames.map((name) => resolved[name.toLowerCase().trim()] ?? '');
}

/** Offset (ms) between UTC and `timeZone` at the given instant. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');

  // Intl renders hour 24 for midnight in some engines; normalise to 0.
  const hour = get('hour') % 24;

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second')
  );

  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock local time ("2026-11-01T09:00") in `timeZone` into a
 * UTC Date. Two passes so the offset is correct across DST boundaries.
 */
export function zonedTimeToUtc(localDateTime: string, timeZone: string): Date | null {
  const match = localDateTime
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    // Fall back to whatever the runtime can parse (e.g. a full ISO string with offset)
    const parsed = new Date(localDateTime);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, year, month, day, hour, minute, second] = match;
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second || '0')
  );

  let result = new Date(naiveUtc - timeZoneOffsetMs(new Date(naiveUtc), timeZone));
  // Second pass corrects the offset when the first guess landed on the other
  // side of a DST transition.
  result = new Date(naiveUtc - timeZoneOffsetMs(result, timeZone));

  return isNaN(result.getTime()) ? null : result;
}

/** Hard ceiling on a daily range, so a typo'd end date cannot expand unbounded. */
export const MAX_RANGE_DAYS = 366;

export interface DailyRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD", inclusive
  time: string; // "HH:mm" local to `timezone`
}

export interface RangeExpansion {
  occurrences: Date[];
  error?: string;
}

/**
 * Expand an inclusive date range into one UTC instant per day, each at the same
 * local wall-clock time. Days are stepped as calendar dates and converted
 * individually, so a DST shift inside the range keeps every send at `time`
 * locally rather than drifting by an hour.
 */
export function expandDailyRange(range: DailyRange, timezone: string): RangeExpansion {
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  const start = range.startDate?.trim().slice(0, 10);
  const end = range.endDate?.trim().slice(0, 10);

  if (!dayPattern.test(start || '') || !dayPattern.test(end || '')) {
    return { occurrences: [], error: 'Start and end dates are required' };
  }

  const time = /^\d{2}:\d{2}$/.test(range.time?.trim() || '') ? range.time.trim() : '10:00';

  const toUtcMidnight = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };

  let cursor = toUtcMidnight(start);
  const last = toUtcMidnight(end);

  if (isNaN(cursor) || isNaN(last)) {
    return { occurrences: [], error: 'Invalid start or end date' };
  }

  if (last < cursor) {
    return { occurrences: [], error: 'End date must be on or after the start date' };
  }

  const dayCount = Math.round((last - cursor) / 86_400_000) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    return {
      occurrences: [],
      error: `A daily range can span at most ${MAX_RANGE_DAYS} days (this one spans ${dayCount})`,
    };
  }

  const occurrences: Date[] = [];
  while (cursor <= last) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    const instant = zonedTimeToUtc(`${day}T${time}`, timezone);
    if (!instant) {
      return { occurrences: [], error: `Could not resolve ${day} ${time} in ${timezone}` };
    }
    occurrences.push(instant);
    cursor += 86_400_000;
  }

  return { occurrences };
}

/** Combine a date-only string ("2026-11-01") and "HH:mm" into a UTC instant. */
export function combineDateAndTime(
  date: string,
  time: string,
  timeZone: string
): Date | null {
  const dayPart = date.trim().slice(0, 10);
  const timePart = /^\d{2}:\d{2}$/.test(time.trim()) ? time.trim() : '10:00';
  return zonedTimeToUtc(`${dayPart}T${timePart}`, timeZone);
}
