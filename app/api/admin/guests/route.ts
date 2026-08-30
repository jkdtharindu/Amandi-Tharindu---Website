import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inMemoryGuestStore } from '@/lib/db';
import type { Guest } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

function requireAdminAuth(): boolean {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('admin_session');
  return !!sessionCookie?.value;
}

export async function POST(req: NextRequest) {
  if (!requireAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code, name, email, whatsapp_number, slot_count, relationship } = body;

    // Validation
    if (!code || !name || !relationship || !slot_count) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, relationship, slot_count' },
        { status: 400 }
      );
    }

    if (slot_count < 1 || slot_count > 10) {
      return NextResponse.json(
        { error: 'Slot count must be between 1 and 10' },
        { status: 400 }
      );
    }

    const guestData: Guest = {
      id: uuidv4(),
      code: code.trim().toUpperCase(),
      name: name.trim(),
      email: email?.trim() || undefined,
      whatsapp_number: whatsapp_number?.trim() || undefined,
      slot_count: parseInt(slot_count, 10),
      relationship: relationship.trim(),
      is_deleted: false,
      rsvp_status: 'pending',
      participant_names: [],
    };

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('guests')
        .insert([guestData])
        .select()
        .single();

      if (error) {
        console.error('Error creating guest:', error);
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Invitation code already exists' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to create guest' },
          { status: 500 }
        );
      }

      return NextResponse.json({ guest: data }, { status: 201 });
    } else {
      inMemoryGuestStore.push(guestData);
      return NextResponse.json({ guest: guestData }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/admin/guests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
