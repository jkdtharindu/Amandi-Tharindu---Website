const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// "3:00 PM", "3pm", "15:00" — the same shapes the admin time picker reads.
const TIME_PATTERN = /^\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?$/i;

export function validateCelebrationEventInput(input) {
  const errors = [];
  const name = String(input?.name || '').trim();
  const eventDate = String(input?.eventDate || '').trim();
  const eventTime = String(input?.eventTime || '').trim();
  const endTime = String(input?.endTime || '').trim();
  const venueName = String(input?.venueName || '').trim();
  const venueAddress = String(input?.venueAddress || '').trim();

  if (!name) {
    errors.push({ field: 'name', reason: 'required' });
  }

  if (!DATE_PATTERN.test(eventDate) || Number.isNaN(new Date(`${eventDate}T00:00:00`).getTime())) {
    errors.push({ field: 'eventDate', reason: 'invalid_date' });
  }

  if (!eventTime) {
    errors.push({ field: 'eventTime', reason: 'required' });
  }

  // The end time is optional; when given it must look like a time. It may be
  // earlier than the start (a reception can run past midnight), so no order check.
  if (endTime && !TIME_PATTERN.test(endTime)) {
    errors.push({ field: 'endTime', reason: 'invalid_time' });
  }

  if (!venueName) {
    errors.push({ field: 'venueName', reason: 'required' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    event: {
      name,
      eventDate,
      eventTime,
      endTime,
      venueName,
      venueAddress,
      imageUrl: String(input?.imageUrl || '').trim(),
      parkingNote: String(input?.parkingNote || '').trim(),
      dressCode: String(input?.dressCode || '').trim(),
      displayOrder: Number.isFinite(Number(input?.displayOrder)) ? Number(input.displayOrder) : 0,
    },
  };
}
