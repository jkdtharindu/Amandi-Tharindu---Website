import { NextRequest, NextResponse } from 'next/server';
import { hallFail, hallFault, readHallChange } from '@/lib/hallLayoutRoute';
import { deleteHallArea, updateHallArea } from '@/src/hall-layout/hallLayoutRepo.js';
import { validateArea } from '@/src/hall-layout/hallLayoutShapes.js';

type RouteContext = { params: Promise<{ areaId: string }> };

const areaNotFound = () => hallFail('Area not found.', 404);

/** Moves or edits an area; only the fields sent are changed. */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const checked = await readHallChange(request);
  if (checked.refusal) return checked.refusal;

  const changes = validateArea(checked.body, { partial: true });
  if (!changes.ok) return hallFail(changes.message ?? '', 400);

  const { areaId } = await context.params;
  try {
    const area = await updateHallArea(areaId, changes.value);
    return area ? NextResponse.json({ success: true, area }) : areaNotFound();
  } catch (error) {
    return hallFault(error, 'save the area');
  }
}

/** Removes an area from the map. Seating tables are removed only through the table routes. */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const checked = await readHallChange(request, { body: false });
  if (checked.refusal) return checked.refusal;

  const { areaId } = await context.params;
  try {
    return (await deleteHallArea(areaId)) ? NextResponse.json({ success: true }) : areaNotFound();
  } catch (error) {
    return hallFault(error, 'remove the area');
  }
}
