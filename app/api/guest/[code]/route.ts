import { NextRequest, NextResponse } from 'next/server';
import { supabase, inMemoryGuestStore } from '@/lib/db';

export async function GET(
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

    return NextResponse.json({
      success: true,
      guest: {
        id: guest.id,
        code: guest.code,
        name: guest.name,
        slot_count: guest.slot_count,
        rsvp_status: guest.rsvp_status || 'pending',
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
