import { NextRequest, NextResponse } from 'next/server';
import { hallFail, hallFault, readHallChange } from '@/lib/hallLayoutRoute';
import { saveTablePosition } from '@/src/hall-layout/hallLayoutRepo.js';
import { validatePosition } from '@/src/hall-layout/hallLayoutShapes.js';

type RouteContext = { params: Promise<{ tableId: string }> };

/**
 * Saves where a table stands on the map: `{ x, y }`. Either admin may move any
 * table, the other side's included (owner's decision). Only the position can be
 * changed here — never the table's name, side, seats or guests.
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const checked = await readHallChange(request);
  if (checked.refusal) return checked.refusal;

  const position = validatePosition(checked.body);
  if (!position.ok) return hallFail(position.message ?? '', 400);

  const { tableId } = await context.params;
  try {
    const saved = await saveTablePosition(tableId, position.value as { x: number; y: number });
    return saved ? NextResponse.json({ success: true }) : hallFail('Table not found.', 404);
  } catch (error) {
    return hallFault(error, 'move the table');
  }
}
