import { NextRequest, NextResponse } from 'next/server';
import { inMemoryGuestStore } from '@/lib/db';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('guest_session')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, reason: 'not_authenticated' },
        { status: 401 }
      );
    }

    // Fetch guest by ID (sessionId is the guest ID)
    let guest;

    if (!isSupabaseConfigured() || !supabase) {
      guest = inMemoryGuestStore.find(
        (g) => g.id === sessionId && !g.is_deleted
      );
    } else {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', sessionId)
        .eq('is_deleted', false)
        .single();

      if (error) {
        console.error('Error fetching guest:', error);
        return NextResponse.json(
          { success: false, reason: 'not_found' },
          { status: 404 }
        );
      }

      guest = data;
    }

    if (!guest) {
      return NextResponse.json(
        { success: false, reason: 'not_found' },
        { status: 404 }
      );
    }

    // Convert rsvp_status to standardized format
    let rsvpStatus = guest.rsvp_status || 'pending';
    if (!isSupabaseConfigured() && guest.participant_names) {
      // In-memory mode: use rsvp_status directly
    } else if (isSupabaseConfigured() && 'attending' in guest) {
      // Supabase mode: convert attending boolean to status
      // Note: This assumes most recent RSVP response; in real app, would fetch from rsvp_responses
      const guestWithAttending = guest as Record<string, unknown>;
      const attending = guestWithAttending.attending as boolean | undefined;
      if (attending === true) rsvpStatus = 'accepted';
      else if (attending === false) rsvpStatus = 'declined';
    }

    return NextResponse.json({
      success: true,
      guest: {
        id: guest.id,
        code: guest.code,
        name: guest.name,
        slot_count: guest.slot_count,
        rsvp_status: rsvpStatus,
        participant_names: guest.participant_names || [],
      },
    });
  } catch (error) {
    console.error('Get guest error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error' },
      { status: 500 }
    );
  }
}
