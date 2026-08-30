import { supabase, isSupabaseConfigured } from './supabase';
import { inMemoryGuestStore } from './db';
import type { Guest } from './db';

export interface LoginResult {
  success: boolean;
  type?: 'exact' | 'candidates';
  guestId?: string;
  sessionId?: string;
  code?: string;
  candidates?: { id: string; name: string; code: string }[];
  reason?: string;
}

async function findGuestByCode(code: string): Promise<Guest | null> {
  if (!isSupabaseConfigured() || !supabase) {
    const guest = inMemoryGuestStore.find(
      (g) => g.code === code && !g.is_deleted
    );
    return guest || null;
  }

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('code', code)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error finding guest by code:', error);
    return null;
  }
  return data;
}

async function findGuestByName(name: string): Promise<Guest | null> {
  const needle = name.trim().toLowerCase();

  if (!isSupabaseConfigured() || !supabase) {
    const guest = inMemoryGuestStore.find(
      (g) => g.name.toLowerCase() === needle && !g.is_deleted
    );
    return guest || null;
  }

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .ilike('name', name)
    .eq('is_deleted', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows returned
    console.error('Error finding guest by name:', error);
    return null;
  }
  return data;
}

async function findGuestCandidatesByName(
  name: string
): Promise<{ id: string; name: string; code: string }[]> {
  const needle = name.trim().toLowerCase();

  if (!isSupabaseConfigured() || !supabase) {
    return inMemoryGuestStore
      .filter((g) => g.name.toLowerCase().includes(needle) && !g.is_deleted)
      .map((g) => ({ id: g.id, name: g.name, code: g.code }));
  }

  const { data, error } = await supabase
    .from('guests')
    .select('id, name, code')
    .ilike('name', `%${name}%`)
    .eq('is_deleted', false);

  if (error) {
    console.error('Error finding guest candidates:', error);
    return [];
  }
  return data || [];
}

export async function loginGuestByCode(code: string): Promise<LoginResult> {
  const guest = await findGuestByCode(code);

  if (!guest) {
    return {
      success: false,
      reason: 'guest_not_found',
    };
  }

  return {
    success: true,
    type: 'exact',
    guestId: guest.id,
    sessionId: guest.id,
    code: guest.code,
  };
}

export async function loginGuestByName(name: string): Promise<LoginResult> {
  if (!name || !String(name).trim()) {
    return { success: false, reason: 'missing_name' };
  }

  const exact = await findGuestByName(name);

  if (exact) {
    return {
      success: true,
      type: 'exact',
      guestId: exact.id,
      sessionId: exact.id,
      code: exact.code,
    };
  }

  const candidates = await findGuestCandidatesByName(name);

  if (candidates.length === 0) {
    return {
      success: false,
      reason: 'guest_not_found',
    };
  }

  return {
    success: false,
    type: 'candidates',
    candidates,
  };
}

export async function getGuestById(id: string): Promise<Guest | null> {
  if (!isSupabaseConfigured() || !supabase) {
    const guest = inMemoryGuestStore.find((g) => g.id === id && !g.is_deleted);
    return guest || null;
  }

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error fetching guest:', error);
    return null;
  }
  return data;
}
