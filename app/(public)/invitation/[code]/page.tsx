import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { findGuestById, findRsvpResponseByGuestId } from '@/src/guest-auth/guestRepo.js';
import { listInviteesForGuest } from '@/src/invitees/inviteesRepo.js';
import { getGuestTableView } from '@/src/table-arrangement/guestTableView.js';
import { verifySession } from '@/src/session.js';
import { getThemeSettings } from '@/src/theme/themeRepo.js';
import { themeSettings as defaultThemeSettings } from '@/src/data/themeStore.js';
import { listEvents } from '@/src/celebration-events/celebrationEventsRepo.js';
import { formatWeddingDate } from '@/src/theme/formatWeddingDate.js';
import type { CelebrationEvent } from '@/components/admin/EventManager';
import InvitationClient from './InvitationClient';
import EnvelopeIntro from '@/components/guest/EnvelopeIntro';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  // Await params - they're Promises in Next.js 16
  const { code } = await params;

  // Get the guest session cookie (cookies() is async in Next.js 16)
  const cookieStore = await cookies();
  const signedSession = cookieStore.get('guest_session')?.value;
  const sessionId = verifySession(signedSession);

  // A guest only ever sees their own invitation. Signed-out visitors are shown
  // the gate by proxy.ts before reaching here; a signed-in guest who opens
  // someone else's link (or a mistyped one) is sent to their own instead of
  // seeing another guest's name and party size.
  const guest = sessionId ? await findGuestById(sessionId) : null;
  if (!guest) redirect('/');
  if (guest.code !== code) redirect(`/invitation/${encodeURIComponent(guest.code)}`);

  const rsvp = await findRsvpResponseByGuestId(guest.id);
  const hasResponded = Boolean(rsvp);
  const rsvpStatus = rsvp ? (rsvp.attending ? 'accepted' : 'declined') : 'pending';

  // Multi-person invitations with named invitees (2026-09) let the guest
  // accept/decline per person instead of one status for the whole party.
  // listInviteesForGuest() must never throw -- same reasoning as
  // getThemeSettings/listEvents below.
  let invitees;
  try {
    invitees = await listInviteesForGuest(guest.id);
  } catch (error) {
    console.error('listInviteesForGuest failed, falling back to none:', error);
    invitees = [];
  }

  // Where the admin has seated this party. Never throws, so a seating hiccup
  // only hides the table line instead of taking the invitation down. The line
  // shows the table's name ("Table N" for an unnamed one) — never its number
  // or its side, which are for the admins only (Action 68).
  let tableViews: { tableNumber: number; tableName: string | null; label: string; mates: string[] }[] = [];
  try {
    tableViews = await getGuestTableView(guest.id);
  } catch (error) {
    console.error('getGuestTableView failed, hiding the table line:', error);
  }

  // getThemeSettings() hits the DB on every request; this must never throw,
  // or a transient DB hiccup takes down every page on the site.
  let settings;
  try {
    settings = await getThemeSettings();
  } catch (error) {
    console.error('getThemeSettings failed, falling back to defaults:', error);
    settings = { ...defaultThemeSettings };
  }

  // listEvents() must never throw, or a transient DB hiccup takes down the
  // page — same reasoning as getThemeSettings above.
  let events: CelebrationEvent[];
  try {
    events = await listEvents();
  } catch (error) {
    console.error('listEvents failed, falling back to none:', error);
    events = [];
  }

  return (
    <div>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="space-y-6">
          <EnvelopeIntro
            guestName={guest.name}
            coupleNames={settings.coupleNames}
            weddingDate={settings.weddingDate ? formatWeddingDate(settings.weddingDate) : ''}
          />

          {/* Guest Info Card */}
          <div className="bg-surface rounded-3xl shadow-lg p-8">
            <h1 className={`text-3xl md:text-4xl font-bold text-heading ${tableViews.length > 0 ? 'mb-2' : 'mb-6'}`}>
              Invitation for {guest.name}
            </h1>

            {tableViews.length > 0 && (
              <div className="mb-6" data-testid="table-assignment">
                {tableViews.map((view, index) => (
                  <p key={`${index}-${view.label}`} className="text-body">
                    <span className="text-lg font-semibold text-heading">{view.label}</span>
                    {view.mates.length > 0 && (
                      <span className="text-sm text-body"> — with {view.mates.join(', ')}</span>
                    )}
                  </p>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 mb-6 text-body">
              <div>
                <p className="text-sm font-semibold text-body mb-1">Code</p>
                <p className="text-lg font-semibold tracking-wide">{guest.code}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-body mb-1">Relationship</p>
                <p className="text-lg">{guest.relationship}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-body mb-1">Party Size</p>
                <p className="text-lg">{guest.slotCount} people</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-body mb-1">RSVP Status</p>
                <p className={`text-lg font-semibold ${
                  rsvpStatus === 'accepted' ? 'text-sage' :
                  rsvpStatus === 'declined' ? 'text-rose' :
                  'text-accent-text'
                }`}>
                  {rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1)}
                </p>
              </div>
            </div>

            {/* Current Status Message */}
            {hasResponded ? (
              <div className="bg-sage-soft border border-sage-line rounded-2xl p-4 text-sage">
                <p>
                  Thank you for your response! Your current status is <strong>{rsvpStatus}</strong>.
                  You can still change your response if needed.
                </p>
              </div>
            ) : (
              <div className="bg-accent-soft border border-accent-line rounded-2xl p-4 text-accent-text">
                <p>We are looking forward to hearing from you about your attendance.</p>
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className="bg-surface rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-heading">Event Details</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {events.map((event) => (
                <div key={event.id}>
                  <h3 className="text-lg font-semibold text-heading mb-2">{event.name}</h3>
                  <p className="text-body mb-1"><strong>Date:</strong> {formatWeddingDate(event.eventDate)}</p>
                  <p className="text-body mb-1"><strong>Time:</strong> {event.eventTime}</p>
                  <p className="text-body mb-3"><strong>Venue:</strong> {event.venueName}</p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(event.venueAddress || event.venueName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline underline-offset-2 hover:underline font-semibold"
                  >
                    View on Google Maps →
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* RSVP Form - Client Component */}
          <InvitationClient
            guestCode={guest.code}
            slotCount={guest.slotCount}
            hasResponded={hasResponded}
            currentRsvpStatus={rsvpStatus}
            coupleNames={settings.coupleNames}
            invitees={invitees}
            weddingDate={settings.weddingDate ? formatWeddingDate(settings.weddingDate) : ''}
          />
        </div>
      </main>
    </div>
  );
}
