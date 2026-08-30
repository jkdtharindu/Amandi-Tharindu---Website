'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAdminClient } from '@/lib/admin-auth';
import type { Guest } from '@/lib/db';

function AdminDashboardContent() {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    accepted: 0,
    declined: 0,
    pending: 0,
  });

  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const client = getAdminClient();
        if (!client) {
          setError('Supabase not configured');
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await client
          .from('guests')
          .select('*')
          .eq('is_deleted', false)
          .returns<Guest[]>();

        if (fetchError) {
          setError(fetchError.message || 'Failed to fetch guests');
          setLoading(false);
          return;
        }

        setGuests((data as Guest[]) || []);

        // Calculate statistics
        const guestList = data || [];
        const newStats = {
          total: guestList.length,
          accepted: guestList.filter((g) => g.rsvp_status === 'accepted').length,
          declined: guestList.filter((g) => g.rsvp_status === 'declined').length,
          pending: guestList.filter((g) => g.rsvp_status === 'pending').length,
        };
        setStats(newStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchGuests();
  }, []);

  const handleSignOut = async () => {
    document.cookie = 'admin_session=; path=/; max-age=0';
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-amber-800 hover:text-amber-900 text-sm">
              View Site
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Total Guests</h3>
            <p className="text-3xl font-bold text-amber-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Accepted</h3>
            <p className="text-3xl font-bold text-green-600">{stats.accepted}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Declined</h3>
            <p className="text-3xl font-bold text-red-600">{stats.declined}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium mb-2">Pending</h3>
            <p className="text-3xl font-bold text-gray-600">{stats.pending}</p>
          </div>
        </div>

        {/* Guest List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Guests</h2>
            <Link
              href="/admin/guests/new"
              className="px-4 py-2 bg-amber-800 text-white rounded hover:bg-amber-900 text-sm font-medium"
            >
              Add Guest
            </Link>
          </div>

          {guests.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-600">
              <p>No guests yet. Add your first guest to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Relationship
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      RSVP Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Slots
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {guests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {guest.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{guest.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {guest.relationship}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            guest.rsvp_status === 'accepted'
                              ? 'bg-green-100 text-green-700'
                              : guest.rsvp_status === 'declined'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {guest.rsvp_status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{guest.slot_count}</td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/admin/guests/${guest.id}/edit`}
                          className="text-amber-800 hover:text-amber-900 font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
