import crypto from 'node:crypto';
import { query } from '../db.js';
import { celebrationEvents } from '../data/celebrationEventsStore.js';
import { toIsoDateString } from '../theme/themeRepo.js';
import { validateCelebrationEventInput } from './validateCelebrationEvent.js';

const useDb = Boolean(process.env.DATABASE_URL);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    eventDate: toIsoDateString(row.event_date),
    eventTime: row.event_time,
    venueName: row.venue_name,
    venueAddress: row.venue_address || '',
    displayOrder: row.display_order,
  };
}

export async function listEvents() {
  if (!useDb) {
    return [...celebrationEvents].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const { rows } = await query('SELECT * FROM celebration_events ORDER BY display_order ASC');
  return rows.map(mapRow);
}

export async function createEvent(input) {
  const result = validateCelebrationEventInput(input);
  if (!result.success) return result;

  const event = { id: crypto.randomUUID(), ...result.event };

  if (!useDb) {
    celebrationEvents.push(event);
    return { success: true, event };
  }

  const { rows } = await query(
    `INSERT INTO celebration_events (name, event_date, event_time, venue_name, venue_address, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [event.name, event.eventDate, event.eventTime, event.venueName, event.venueAddress, event.displayOrder]
  );
  return { success: true, event: mapRow(rows[0]) };
}

export async function updateEvent(id, patch) {
  if (!useDb) {
    const existing = celebrationEvents.find((e) => e.id === id);
    if (!existing) return { success: false, reason: 'event_not_found' };

    if (patch.name !== undefined) existing.name = String(patch.name).trim();
    if (patch.eventDate !== undefined) existing.eventDate = String(patch.eventDate).trim();
    if (patch.eventTime !== undefined) existing.eventTime = String(patch.eventTime).trim();
    if (patch.venueName !== undefined) existing.venueName = String(patch.venueName).trim();
    if (patch.venueAddress !== undefined) existing.venueAddress = String(patch.venueAddress).trim();
    if (patch.displayOrder !== undefined) existing.displayOrder = Number(patch.displayOrder) || 0;

    return { success: true, event: existing };
  }

  const { rows: existingRows } = await query('SELECT * FROM celebration_events WHERE id = $1', [id]);
  if (!existingRows[0]) return { success: false, reason: 'event_not_found' };

  const current = mapRow(existingRows[0]);
  const next = {
    name: patch.name !== undefined ? String(patch.name).trim() : current.name,
    eventDate: patch.eventDate !== undefined ? String(patch.eventDate).trim() : current.eventDate,
    eventTime: patch.eventTime !== undefined ? String(patch.eventTime).trim() : current.eventTime,
    venueName: patch.venueName !== undefined ? String(patch.venueName).trim() : current.venueName,
    venueAddress: patch.venueAddress !== undefined ? String(patch.venueAddress).trim() : current.venueAddress,
    displayOrder: patch.displayOrder !== undefined ? Number(patch.displayOrder) || 0 : current.displayOrder,
  };

  const { rows } = await query(
    `UPDATE celebration_events SET name = $1, event_date = $2, event_time = $3, venue_name = $4, venue_address = $5, display_order = $6
     WHERE id = $7 RETURNING *`,
    [next.name, next.eventDate, next.eventTime, next.venueName, next.venueAddress, next.displayOrder, id]
  );
  return { success: true, event: mapRow(rows[0]) };
}

export async function deleteEvent(id) {
  if (!useDb) {
    const index = celebrationEvents.findIndex((e) => e.id === id);
    if (index === -1) return { success: false, reason: 'event_not_found' };
    celebrationEvents.splice(index, 1);
    return { success: true };
  }

  await query('DELETE FROM celebration_events WHERE id = $1', [id]);
  return { success: true };
}
