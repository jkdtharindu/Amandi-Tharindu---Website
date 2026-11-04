/**
 * What guests read for an event's time: "3:00 PM – 6:00 PM" when an end time
 * is set, otherwise just the start time. Times are shown exactly as stored
 * (Sri Lanka time), never converted.
 */
export function formatEventTimeRange(startTime, endTime) {
  const start = String(startTime ?? '').trim();
  const end = String(endTime ?? '').trim();
  return end ? `${start} – ${end}` : start;
}
