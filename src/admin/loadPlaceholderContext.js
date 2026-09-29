import { getThemeSettings } from '../theme/themeRepo.js';
import { formatWeddingDate } from '../theme/formatWeddingDate.js';
import { listEvents } from '../celebration-events/celebrationEventsRepo.js';

/**
 * [Date] and [Venue] placeholder values shared by every outbound guest message —
 * the Messages screen and the Guests page's per-guest drop-down both use this,
 * so a reminder never quotes a date the site has since changed. Both are
 * best-effort — a messaging run should not fail because the theme or events
 * table is unreachable.
 */
export async function loadPlaceholderContext() {
  let weddingDate = '';
  let venueName = '';

  try {
    const theme = await getThemeSettings();
    weddingDate = theme?.weddingDate ? formatWeddingDate(theme.weddingDate) : '';
    venueName = theme?.venueName || '';
  } catch {
    // fall through to the event lookup below
  }

  if (!venueName) {
    try {
      const events = await listEvents();
      venueName = events[0]?.venueName || '';
    } catch {
      venueName = '';
    }
  }

  return { weddingDate, venueName };
}
