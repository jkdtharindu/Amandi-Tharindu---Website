'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Guest {
  id: number;
  code: string;
  name: string;
  slot_count: number;
}

interface RSVPFormData {
  status: 'accepted' | 'declined' | '';
  participants: string[];
}

export default function InvitationPage() {
  const params = useParams();
  const code = params.code as string;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<RSVPFormData>({
    status: '',
    participants: [],
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchGuest = async () => {
      try {
        const response = await fetch(`/api/guest/${code}`);
        if (!response.ok) {
          setError('Invitation not found');
          setLoading(false);
          return;
        }
        const data = await response.json();
        setGuest(data.guest);
        setFormData({
          status: data.guest.rsvp_status || '',
          participants: data.guest.participant_names || Array(data.guest.slot_count).fill(''),
        });
      } catch {
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchGuest();
  }, [code]);

  const handleStatusChange = (status: 'accepted' | 'declined') => {
    setFormData({ ...formData, status });
  };

  const handleParticipantChange = (index: number, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = value;
    setFormData({ ...formData, participants: newParticipants });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.status) {
      setError('Please select your response');
      return;
    }

    try {
      const response = await fetch(`/api/guest/${code}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          participants: formData.participants.filter((p) => p.trim()),
        }),
      });

      if (!response.ok) {
        setError('Failed to submit RSVP');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('An error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading your invitation...</p>
      </div>
    );
  }

  if (error && !guest) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/login" className="text-amber-800 hover:text-amber-900">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!guest) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <div className="bg-amber-900 text-white py-8 px-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Amandi & Tharindu</h1>
        <p className="text-amber-100">December 14, 2026</p>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Greeting */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold text-amber-900 mb-4">
            Hello, {guest.name}!
          </h2>
          <p className="text-gray-700 mb-4">
            We are delighted to invite you to celebrate with us on our special day.
          </p>
          <p className="text-gray-700">
            You are invited to bring <strong>{guest.slot_count}</strong> guest(s) to the celebration.
          </p>
        </section>

        {/* RSVP Form */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
            <h3 className="text-xl font-bold text-amber-900 mb-6">Your Response</h3>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Response Options */}
            <div className="mb-6">
              <p className="font-medium text-gray-900 mb-3">Will you be attending?</p>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="accepted"
                    checked={formData.status === 'accepted'}
                    onChange={(e) => handleStatusChange(e.target.value as 'accepted')}
                    className="mr-3"
                  />
                  <span className="text-gray-700">Yes, I will attend</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="declined"
                    checked={formData.status === 'declined'}
                    onChange={(e) => handleStatusChange(e.target.value as 'declined')}
                    className="mr-3"
                  />
                  <span className="text-gray-700">No, I cannot attend</span>
                </label>
              </div>
            </div>

            {/* Participant Names */}
            {formData.status === 'accepted' && (
              <div className="mb-6">
                <p className="font-medium text-gray-900 mb-3">
                  Participant Names
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Please provide the names of all attendees (including yourself)
                </p>
                <div className="space-y-3">
                  {formData.participants.map((_, index) => (
                    <input
                      key={index}
                      type="text"
                      value={formData.participants[index]}
                      onChange={(e) => handleParticipantChange(index, e.target.value)}
                      placeholder={`Guest ${index + 1}`}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-amber-800 text-white py-3 rounded-lg hover:bg-amber-900 transition font-medium"
            >
              Submit Response
            </button>
          </form>
        ) : (
          /* Confirmation Message */
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-green-900 mb-2">
              Thank You!
            </h3>
            <p className="text-green-800 mb-6">
              Your response has been recorded. We look forward to celebrating with you!
            </p>
            <Link
              href="/"
              className="inline-block bg-amber-800 text-white px-6 py-2 rounded-lg hover:bg-amber-900 transition"
            >
              Return Home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
