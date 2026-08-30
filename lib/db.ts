export type Guest = {
  id: string;
  code: string;
  name: string;
  email?: string;
  whatsapp_number?: string;
  slot_count: number;
  relationship: string;
  is_deleted: boolean;
  rsvp_status?: 'accepted' | 'declined' | 'pending';
  participant_names?: string[];
  has_visited?: boolean;
  created_at?: string;
};

export type RSVPResponse = {
  id: string;
  guest_id: string;
  attending: boolean;
  participant_names: string[];
  submitted_at: string;
  updated_at: string;
};

// In-memory fallback stores for development without Supabase
export const inMemoryGuestStore: Guest[] = [
  {
    id: '1',
    code: 'DEMO-001',
    name: 'Demo Guest',
    email: 'demo@example.com',
    slot_count: 2,
    relationship: 'Friends',
    is_deleted: false,
    rsvp_status: 'pending',
    participant_names: [],
  },
];

export const inMemoryRsvpStore: RSVPResponse[] = [];
