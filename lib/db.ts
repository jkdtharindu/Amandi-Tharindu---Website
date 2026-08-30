/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch {
    console.warn('Failed to initialize Supabase');
  }
} else {
  console.warn(
    'Supabase credentials not configured. Using in-memory fallback for development.'
  );
}

export { supabase };

// Fallback in-memory store for development without Supabase
export const inMemoryGuestStore = [
  {
    id: 1,
    code: 'DEMO-001',
    name: 'Demo Guest',
    email: 'demo@example.com',
    slot_count: 2,
    relationship: 'Friends',
    is_deleted: false,
  },
];

export const inMemoryRsvpStore: RSVPResponse[] = [];

export type Guest = {
  id: number;
  code: string;
  name: string;
  email?: string;
  slot_count: number;
  relationship: string;
  is_deleted: boolean;
  rsvp_status?: 'accepted' | 'declined' | 'pending';
  participant_names?: string[];
};

export type RSVPResponse = {
  id: number;
  guest_id: number;
  rsvp_status: 'accepted' | 'declined' | 'pending';
  participant_names: string[];
  created_at: string;
  updated_at: string;
};
