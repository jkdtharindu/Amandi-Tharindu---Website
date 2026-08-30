'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Candidate {
  id: number;
  name: string;
  code: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<'code' | 'name'>('code');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCandidates([]);

    try {
      const response = await fetch('/api/guest/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [method === 'code' ? 'code' : 'name']: input,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.type === 'candidates' && data.candidates) {
          setCandidates(data.candidates);
          setError('');
        } else {
          setError(
            data.reason === 'guest_not_found'
              ? 'Invitation not found. Please check and try again.'
              : 'An error occurred. Please try again.'
          );
        }
        setLoading(false);
        return;
      }

      // Success - redirect to invitation
      router.push(`/invitation/${data.code}`);
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleSelectCandidate = async (candidate: Candidate) => {
    setLoading(true);
    try {
      const response = await fetch('/api/guest/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: candidate.code }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/invitation/${data.code}`);
      } else {
        setError('Failed to select this invitation. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-900 mb-2">
            Amandi & Tharindu
          </h1>
          <p className="text-amber-700">Access Your Invitation</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          {/* Login Method Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              type="button"
              onClick={() => {
                setMethod('code');
                setInput('');
                setCandidates([]);
                setError('');
              }}
              className={`pb-3 font-medium transition ${
                method === 'code'
                  ? 'border-b-2 border-amber-800 text-amber-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Invitation Code
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('name');
                setInput('');
                setCandidates([]);
                setError('');
              }}
              className={`pb-3 font-medium transition ${
                method === 'name'
                  ? 'border-b-2 border-amber-800 text-amber-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Your Name
            </button>
          </div>

          {/* Input Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {method === 'code' ? 'Enter your invitation code' : 'Enter your name'}
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                method === 'code' ? 'e.g., SILVA-001' : 'e.g., Nimal Silva'
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Candidate List */}
          {candidates.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                Multiple invitations found. Please select yours:
              </p>
              <div className="space-y-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleSelectCandidate(candidate)}
                    disabled={loading}
                    className="w-full p-3 border border-amber-200 rounded-lg text-left hover:bg-amber-50 transition disabled:opacity-50"
                  >
                    <div className="font-medium text-amber-900">{candidate.name}</div>
                    <div className="text-sm text-gray-600">{candidate.code}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full bg-amber-800 text-white py-2 rounded-lg hover:bg-amber-900 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Loading...' : 'Continue'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6">
          <Link href="/" className="text-amber-800 hover:text-amber-900 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
