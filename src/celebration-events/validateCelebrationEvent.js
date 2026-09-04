const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateCelebrationEventInput(input) {
  const errors = [];
  const name = String(input?.name || '').trim();
  const eventDate = String(input?.eventDate || '').trim();
  const eventTime = String(input?.eventTime || '').trim();
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
      venueName,
      venueAddress,
      displayOrder: Number.isFinite(Number(input?.displayOrder)) ? Number(input.displayOrder) : 0,
    },
  };
}
