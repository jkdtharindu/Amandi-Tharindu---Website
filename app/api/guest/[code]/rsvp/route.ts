import { NextRequest, NextResponse } from 'next/server';
import { supabase, inMemoryRsvpStore, inMemoryGuestStore } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code;
    const sessionId = request.cookies.get('guest_session')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, reason: 'not_authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, participants } = body;

    if (!status || !['accepted', 'declined'].includes(status)) {
      return NextResponse.json(
        { success: false, reason: 'invalid_status' },
        { status: 400 }
      );
    }

    // Find guest
    let guest;
    if (!process.env.SUPABASE_URL) {
      guest = inMemoryGuestStore.find(
        (g) => g.code === code && !g.is_deleted
      );
    } else {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('code', code)
        .eq('is_deleted', false)
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, reason: 'guest_not_found' },
          { status: 404 }
        );
      }

      guest = data;
    }

    if (!guest) {
      return NextResponse.json(
        { success: false, reason: 'guest_not_found' },
        { status: 404 }
      );
    }

    // Save RSVP
    const rsvpData = {
      guest_id: guest.id,
      rsvp_status: status,
      participant_names: status === 'accepted' ? participants || [] : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!process.env.SUPABASE_URL) {
      // In-memory store
      inMemoryRsvpStore.push({
        id: inMemoryRsvpStore.length + 1,
        ...rsvpData,
      });
      // Also update guest record
      const guestIndex = inMemoryGuestStore.findIndex((g) => g.id === guest.id);
      if (guestIndex >= 0) {
        const g = inMemoryGuestStore[guestIndex] as unknown as Record<string, unknown>;
        g.rsvp_status = status;
        g.participant_names = rsvpData.participant_names;
      }
    } else {
      // Supabase
      const { error: insertError } = await supabase
        .from('rsvp_responses')
        .insert([rsvpData]);

      if (insertError) {
        console.error('RSVP insert error:', insertError);
        return NextResponse.json(
          { success: false, reason: 'save_failed' },
          { status: 500 }
        );
      }

      // Update guest rsvp_status
      await supabase
        .from('guests')
        .update({
          rsvp_status: status,
          participant_names: rsvpData.participant_names,
        })
        .eq('id', guest.id);
    }

    return NextResponse.json({
      success: true,
      message: 'RSVP submitted successfully',
    });
  } catch (error) {
    console.error('RSVP submission error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error' },
      { status: 500 }
    );
  }
}
