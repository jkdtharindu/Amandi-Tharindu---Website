import { NextRequest, NextResponse } from 'next/server';
import { hallFail, hallFault, readHallChange } from '@/lib/hallLayoutRoute';
import { createHallArea } from '@/src/hall-layout/hallLayoutRepo.js';
import { validateArea } from '@/src/hall-layout/hallLayoutShapes.js';

/** Adds an area (stage, bar, arrow and so on) to the shared hall map. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const checked = await readHallChange(request);
  if (checked.refusal) return checked.refusal;

  const area = validateArea(checked.body);
  if (!area.ok) return hallFail(area.message ?? '', 400);

  try {
    return NextResponse.json({ success: true, area: await createHallArea(area.value) }, { status: 201 });
  } catch (error) {
    return hallFault(error, 'add the area');
  }
}
