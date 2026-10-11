'use client';

/**
 * Time picker for a celebration event: hour, minute and an AM/PM choice.
 *
 * The value is stored as plain text like "10:30 AM" and shown to guests exactly
 * as typed — it is never converted from the server's clock, so it always means
 * Sri Lanka time (the time on the invitation).
 */
const SELECT_CLASS = 'px-2 py-2 rounded-lg border border-slate-300 text-sm bg-white';

interface ParsedTime {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
}

/** Reads "10:30 AM", "10.12", "3pm" or "15:00". Anything unreadable gives blanks. */
export function parseEventTime(value: string): ParsedTime {
  const match = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*$/i.exec(value || '');
  if (!match) return { hour: '', minute: '', period: 'AM' };

  let hour = Number(match[1]);
  const minute = match[2] ?? '00';
  let period: 'AM' | 'PM' = match[3]?.toUpperCase() === 'PM' ? 'PM' : 'AM';

  if (!match[3] && hour >= 13) {
    // A 24-hour value such as "15:00".
    period = 'PM';
    hour -= 12;
  } else if (!match[3] && hour === 0) {
    hour = 12;
  }
  if (hour < 1 || hour > 12) return { hour: '', minute: '', period: 'AM' };
  return { hour: String(hour), minute, period };
}

function formatEventTime({ hour, minute, period }: ParsedTime): string {
  if (!hour) return '';
  return `${hour}:${minute || '00'} ${period}`;
}

export default function EventTimeInput({
  id,
  value,
  onChange,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const parsed = parseEventTime(value);
  const update = (patch: Partial<ParsedTime>) => {
    const next = { ...parsed, ...patch };
    // Picking only AM/PM before an hour is chosen starts at 12:00.
    if (!next.hour && (patch.minute !== undefined || patch.period !== undefined)) next.hour = '12';
    onChange(formatEventTime(next));
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        id={id}
        aria-label="Hour"
        required={required}
        value={parsed.hour}
        onChange={(e) => update({ hour: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">--</option>
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select
        aria-label="Minute"
        value={parsed.minute || '00'}
        onChange={(e) => update({ minute: e.target.value })}
        className={SELECT_CLASS}
      >
        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        {/* Keeps an existing odd minute such as :12 selectable. */}
        {parsed.minute && Number(parsed.minute) % 5 !== 0 && (
          <option value={parsed.minute}>{parsed.minute}</option>
        )}
      </select>
      <select
        aria-label="AM or PM"
        value={parsed.period}
        onChange={(e) => update({ period: e.target.value as 'AM' | 'PM' })}
        className={SELECT_CLASS}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
