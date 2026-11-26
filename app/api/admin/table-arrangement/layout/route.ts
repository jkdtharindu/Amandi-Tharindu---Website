import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';
import { MISSING_LAYOUT_MESSAGE, hallFail, hallFault, readHallChange } from '@/lib/hallLayoutRoute';
import { generateHallLayout, loadHallLayout, resetHallLayout } from '@/src/hall-layout/hallLayoutRepo.js';
import { validateTableCount } from '@/src/hall-layout/hallLayoutShapes.js';

/**
 * The shared hall map: every table's number, name, side and position, plus the
 * drawn areas. No guest names or seats, so both admins may read the whole room.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();
  try {
    return NextResponse.json({ success: true, ...(await loadHallLayout()) });
  } catch (error) {
    return hallFault(error, 'load the hall layout');
  }
}

/**
 * `{ action: 'generate', tableCount }` creates any missing table from 1 to the
 * count (empty, Common) and lays out the map; nothing existing is changed.
 * `{ action: 'reset' }` puts the map back to the hotel plan.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const checked = await readHallChange(request);
  if (checked.refusal) return checked.refusal;
  const { action, tableCount } = checked.body ?? {};

  try {
    if (action === 'reset') {
      await resetHallLayout();
      return NextResponse.json({ success: true });
    }
    if (action !== 'generate') return hallFail('Unknown action.', 400);

    const count = validateTableCount(tableCount);
    if (!count.ok) return hallFail(count.message ?? '', 400);
    const result = await generateHallLayout(count.value as number);
    if (!result) return hallFail(MISSING_LAYOUT_MESSAGE, 503);
    return NextResponse.json({ success: true, created: result.created });
  } catch (error) {
    return hallFault(error, 'update the hall layout');
  }
}
