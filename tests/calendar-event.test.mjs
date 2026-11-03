import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCalendarEvent } from '../src/calendar/calendarEvent.js';

const input = {
  title: 'Tharindu & Amandi — Wedding',
  date: '2026-12-14',
  time: '15:00',
  venueName: 'Grand Hall',
  venueAddress: 'Colombo 7',
};

test('the ceremony time is Sri Lanka time, turned into one real moment (UTC)', () => {
  const event = buildCalendarEvent(input);
  assert.match(event.ics, /DTSTART:20261214T093000Z/);
  assert.match(event.ics, /DTEND:20261214T133000Z/);
  assert.match(event.googleUrl, /dates=20261214T093000Z%2F20261214T133000Z/);
});

test('the file is a valid calendar with the venue as the location, commas escaped', () => {
  const { ics } = buildCalendarEvent(input);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /LOCATION:Grand Hall\\, Colombo 7/);
  assert.match(ics, /SUMMARY:Tharindu & Amandi — Wedding/);
});

test('the Google link carries the title and the place', () => {
  const { googleUrl } = buildCalendarEvent(input);
  assert.ok(googleUrl.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.match(googleUrl, /location=Grand\+Hall%2C\+Colombo\+7/);
});

test('no usable date means no calendar event', () => {
  assert.equal(buildCalendarEvent({ ...input, date: '' }), null);
  assert.equal(buildCalendarEvent({ ...input, date: 'not-a-date' }), null);
});
