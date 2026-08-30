import { supabase, inMemoryGuestStore, Guest } from './db';

export interface LoginResult {
  success: boolean;
  type?: 'exact' | 'candidates';
  guestId?: number;
  sessionId?: number;
  code?: string;
  candidates?: { id: number; name: string; code: string }[];
  reason?: string;
}

async function findGuestByCode(code: string): Promise<Guest | null> {
  if (!process.env.SUPABASE_URL) {
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

  if (error) return null;
  return data;
}

async function findGuestByName(name: string): Promise<Guest | null> {
  const needle = name.trim().toLowerCase();

  if (!process.env.SUPABASE_URL) {
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

  if (error) return null;
  return data;
}

async function findGuestCandidatesByName(
  name: string
): Promise<{ id: number; name: string; code: string }[]> {
  const needle = name.trim().toLowerCase();

  if (!process.env.SUPABASE_URL) {
    return inMemoryGuestStore
      .filter(
        (g) =>
          g.name.toLowerCase().includes(needle) && !g.is_deleted
      )
      .map((g) => ({ id: g.id, name: g.name, code: g.code }));
  }

  const { data, error } = await supabase
    .from('guests')
    .select('id, name, code')
    .ilike('name', `%${name}%`)
    .eq('is_deleted', false);

  if (error) return [];
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
