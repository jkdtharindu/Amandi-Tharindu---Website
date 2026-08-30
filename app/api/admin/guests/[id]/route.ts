import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inMemoryGuestStore } from '@/lib/db';
import type { Guest } from '@/lib/db';

function requireAdminAuth(): boolean {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('admin_session');
  return !!sessionCookie?.value;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
        }
        console.error('Error fetching guest:', error);
        return NextResponse.json(
          { error: 'Failed to fetch guest' },
          { status: 500 }
        );
      }

      return NextResponse.json({ guest: data });
    } else {
      const guest = inMemoryGuestStore.find((g) => g.id === id && !g.is_deleted);
      if (!guest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }
      return NextResponse.json({ guest });
    }
  } catch (error) {
    console.error('Error in GET /api/admin/guests/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
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

    const updateData = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      email: email?.trim() || null,
      whatsapp_number: whatsapp_number?.trim() || null,
      slot_count: parseInt(slot_count, 10),
      relationship: relationship.trim(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('guests')
        .update(updateData)
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
        }
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Invitation code already exists' },
            { status: 409 }
          );
        }
        console.error('Error updating guest:', error);
        return NextResponse.json(
          { error: 'Failed to update guest' },
          { status: 500 }
        );
      }

      return NextResponse.json({ guest: data });
    } else {
      const guestIndex = inMemoryGuestStore.findIndex(
        (g) => g.id === id && !g.is_deleted
      );
      if (guestIndex === -1) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }

      const updatedGuest: Guest = {
        ...inMemoryGuestStore[guestIndex],
        ...updateData,
      };
      inMemoryGuestStore[guestIndex] = updatedGuest;

      return NextResponse.json({ guest: updatedGuest });
    }
  } catch (error) {
    console.error('Error in PUT /api/admin/guests/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('guests')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
        }
        console.error('Error deleting guest:', error);
        return NextResponse.json(
          { error: 'Failed to delete guest' },
          { status: 500 }
        );
      }

      return NextResponse.json({ guest: data });
    } else {
      const guestIndex = inMemoryGuestStore.findIndex(
        (g) => g.id === id && !g.is_deleted
      );
      if (guestIndex === -1) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }

      inMemoryGuestStore[guestIndex].is_deleted = true;

      return NextResponse.json({ guest: inMemoryGuestStore[guestIndex] });
    }
  } catch (error) {
    console.error('Error in DELETE /api/admin/guests/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
