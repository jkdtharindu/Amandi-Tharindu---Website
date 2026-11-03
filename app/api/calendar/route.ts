import { NextResponse } from 'next/server';
import { getThemeSettings } from '@/src/theme/themeRepo.js';
import { themeSettings as defaultThemeSettings } from '@/src/data/themeStore.js';
import { getSiteTextSafe } from '@/src/site-text/siteTextRepo.js';
import { createT } from '@/src/site-text/siteTextRegistry.js';
import { buildCalendarEvent } from '@/src/calendar/calendarEvent.js';

/** The wedding as a .ics file, for the "Add to calendar" button on the home page. */
export async function GET(): Promise<NextResponse> {
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error('getThemeSettings failed, using defaults for the calendar file:', error);
    settings = { ...defaultThemeSettings };
  }
  const t = createT(await getSiteTextSafe());
  const event = buildCalendarEvent({
    title: t('calendar.eventTitle', { coupleNames: settings.coupleNames }),
    date: settings.weddingDate,
    time: settings.weddingTime,
    venueName: settings.venueName,
    venueAddress: settings.venueAddress,
  });
  if (!event) return NextResponse.json({ success: false, message: 'No wedding date set yet.' }, { status: 404 });

  return new NextResponse(event.ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wedding.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
