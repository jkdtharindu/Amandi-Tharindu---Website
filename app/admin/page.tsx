'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Admin login (PRD P0-09). */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setError('Could not reach the server. Please reload.'));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        router.replace('/admin/dashboard');
        router.refresh();
        return;
      }
      setError(data.message || 'Login failed.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold mb-1">Admin sign in</h1>
        <p className="text-sm text-slate-500 mb-6">
          Manage the guest list and RSVPs.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !csrfToken}
            className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
