import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { inMemoryRsvpStore, inMemoryGuestStore } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
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
    const attending = status === 'accepted';
    const participantNames = status === 'accepted' ? participants || [] : [];

    if (!isSupabaseConfigured() || !supabase) {
      // In-memory store
      inMemoryRsvpStore.push({
        id: `rsvp-${Date.now()}`,
        guest_id: guest.id,
        attending,
        participant_names: participantNames,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Also update guest record
      const guestIndex = inMemoryGuestStore.findIndex((g) => g.id === guest.id);
      if (guestIndex >= 0) {
        inMemoryGuestStore[guestIndex].rsvp_status = status;
        inMemoryGuestStore[guestIndex].participant_names = participantNames;
      }
    } else {
      // Supabase: Insert into rsvp_responses
      const { error: insertError } = await supabase
        .from('rsvp_responses')
        .insert([
          {
            guest_id: guest.id,
            attending,
            participant_names: participantNames,
          },
        ]);

      if (insertError) {
        console.error('RSVP insert error:', insertError);
        return NextResponse.json(
          { success: false, reason: 'save_failed' },
          { status: 500 }
        );
      }

      // Update guest rsvp_status
      const { error: updateError } = await supabase
        .from('guests')
        .update({
          rsvp_status: status,
        })
        .eq('id', guest.id);

      if (updateError) {
        console.error('Guest update error:', updateError);
        // Don't fail; the RSVP was saved
      }
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
