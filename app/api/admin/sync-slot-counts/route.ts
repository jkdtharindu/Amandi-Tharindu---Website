import { NextRequest, NextResponse } from 'next/server';
import { listAllGuests } from '@/src/admin/adminRepo.js';
import { syncGuestSlotCountToInvitees } from '@/src/admin/adminRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Syncs all guests' slotCounts to match their actual approved invitee counts.
 * This ensures consistency if any guests have drifted (e.g., due to prior bugs).
 * Admin-only endpoint.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  try {
    const guests = await listAllGuests();
    let synced = 0;
    let errors = 0;

    for (const guest of guests) {
      if (guest.isDeleted) continue;

      try {
        await syncGuestSlotCountToInvitees(guest.id);
        synced++;
      } catch (error) {
        console.error(`Failed to sync guest ${guest.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} guest(s). ${errors} error(s).`,
      synced,
      errors,
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { success: false, message: 'Could not sync slot counts.' },
      { status: 500 }
    );
  }
}
