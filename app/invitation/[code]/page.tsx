import { cookies } from 'next/headers';
import { findGuestByCode, findRsvpResponseByGuestId } from '@/src/guest-auth/guestRepo.js';
import { verifySession } from '@/src/session.js';
import SiteHeader from '@/components/public/SiteHeader';
import PageFooter from '@/components/public/PageFooter';
import InvitationClient from './InvitationClient';

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

  // Fetch guest data
  const guest = await findGuestByCode(code);

  if (!guest) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Invitation not found</h1>
            <p className="text-red-700 mb-6">
              We couldn't find an invitation with code <strong>{code}</strong>.
            </p>
            <a href="/login" className="inline-block py-2 px-6 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700">
              Back to login
            </a>
          </div>
        </main>
        <PageFooter />
      </div>
    );
  }

  // Check if user is logged in and fetch RSVP status
  const loggedIn = sessionId === guest.id;
  const rsvp = loggedIn ? await findRsvpResponseByGuestId(guest.id) : null;
  const hasResponded = Boolean(rsvp);
  const rsvpStatus = rsvp ? (rsvp.attending ? 'accepted' : 'declined') : 'pending';

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="space-y-6">
          {/* Guest Info Card */}
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">
              Invitation for {guest.name}
            </h1>

            <div className="grid md:grid-cols-2 gap-4 mb-6 text-gray-700">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Code</p>
                <p className="text-lg font-mono">{guest.code}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Relationship</p>
                <p className="text-lg">{guest.relationship}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Party Size</p>
                <p className="text-lg">{guest.slotCount} people</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">RSVP Status</p>
                <p className={`text-lg font-semibold ${
                  rsvpStatus === 'accepted' ? 'text-green-600' :
                  rsvpStatus === 'declined' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1)}
                </p>
              </div>
            </div>

            {/* Current Status Message */}
            {hasResponded ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-800">
                <p>
                  Thank you for your response! Your current status is <strong>{rsvpStatus}</strong>.
                  You can still change your response if needed.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800">
                <p>We are looking forward to hearing from you about your attendance.</p>
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Event Details</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ceremony</h3>
                <p className="text-gray-700 mb-1"><strong>Date:</strong> Monday, 14 December 2026</p>
                <p className="text-gray-700 mb-1"><strong>Time:</strong> 3:00 PM</p>
                <p className="text-gray-700 mb-3"><strong>Venue:</strong> Sunrise Garden Hall</p>
                <a
                  href="https://maps.google.com/?q=Sunrise Garden Hall"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  View on Google Maps →
                </a>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Reception</h3>
                <p className="text-gray-700 mb-1"><strong>Date:</strong> Monday, 14 December 2026</p>
                <p className="text-gray-700 mb-1"><strong>Time:</strong> 6:00 PM</p>
                <p className="text-gray-700 mb-3"><strong>Venue:</strong> Moonlight Banquet Hall</p>
                <a
                  href="https://maps.google.com/?q=Moonlight Banquet Hall"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold"
                >
                  View on Google Maps →
                </a>
              </div>
            </div>
          </div>

          {/* RSVP Form - Client Component */}
          <InvitationClient
            guestCode={guest.code}
            slotCount={guest.slotCount}
            hasResponded={hasResponded}
            currentRsvpStatus={rsvpStatus}
          />
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
