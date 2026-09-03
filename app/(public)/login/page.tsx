'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Candidate = { id?: string; code: string; name: string };

type LoginResult = {
  success?: boolean;
  guestId?: string;
  code?: string;
  type?: string;
  candidates?: Candidate[];
  error?: string;
};

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState<LoginResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    // Fetch CSRF token on component mount
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => setCsrfToken(data.token))
      .catch(err => console.error('Failed to fetch CSRF token:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = identifier.trim();

    if (!trimmed) {
      setResult({ error: 'Please enter a code or name.' });
      return;
    }

    setLoading(true);
    try {
      const payload = trimmed.includes('-') ? { code: trimmed } : { name: trimmed };
      const res = await fetch('/api/guest/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          guestId: data.guestId,
          code: data.code,
        });
      } else if (data.type === 'candidates') {
        setResult({
          candidates: data.candidates,
          type: 'candidates',
        });
      } else {
        setResult({ error: data.message || data.reason || 'Login failed.' });
      }
    } catch {
      setResult({ error: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/guest/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          guestId: data.guestId,
          code: data.code,
        });
      } else {
        setResult({ error: 'Could not select that guest. Please try again.' });
      }
    } catch {
      setResult({ error: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 text-sky-700 text-sm font-semibold mb-6">
              🎟️ Guest login
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Access your invitation securely.
            </h1>
            <p className="text-lg text-gray-600">
              Enter your invitation code or full name so we can locate your personalized wedding invitation.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 mb-8">
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-3">
                Code or Name
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="off"
                placeholder="SILVA-001 or Nimal Silva"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Success state */}
          {result?.success && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <p className="text-green-800 mb-4">
                Success! Logged in as <strong>{result.guestId}</strong>.
              </p>
              <Link
                href={`/invitation/${result.code}`}
                className="inline-block py-2 px-6 rounded-full bg-green-600 text-white font-bold hover:bg-green-700 transition-colors"
              >
                Go to your invitation →
              </Link>
            </div>
          )}

          {/* Candidates state */}
          {result?.type === 'candidates' && result.candidates && result.candidates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <p className="text-blue-900 font-semibold mb-4">
                Multiple matches found. Please select your guest record:
              </p>
              <div className="space-y-3">
                {result.candidates.map((candidate: Candidate) => (
                  <div
                    key={candidate.code}
                    className="flex items-center justify-between bg-white p-4 rounded-xl border border-blue-100"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{candidate.name}</p>
                      <p className="text-sm text-gray-600">{candidate.code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectCandidate(candidate.code)}
                      disabled={loading}
                      className="py-2 px-4 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-red-800 font-semibold">{result.error}</p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Need help? <Link href="/" className="text-blue-600 hover:underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
