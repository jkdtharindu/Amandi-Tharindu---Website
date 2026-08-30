'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { adminSignIn } from '@/lib/admin-auth';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { session, error: signInError } = await adminSignIn(email, password);

      if (signInError) {
        setError(signInError.message || 'Failed to sign in');
        setLoading(false);
        return;
      }

      if (session) {
        // Set session cookie and redirect
        document.cookie = `admin_session=${session.access_token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

        // Redirect to dashboard or the page they came from
        const redirectUrl = searchParams.get('redirect') || '/admin/dashboard';
        router.push(redirectUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-900 mb-2">Admin Panel</h1>
          <p className="text-amber-700">Sign in to manage your wedding</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={loading}
              required
            />
          </div>

          {/* Password Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={loading}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-amber-800 text-white py-2 rounded-lg hover:bg-amber-900 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link href="/" className="text-amber-800 hover:text-amber-900 text-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          <p className="font-medium mb-2">First time signing in?</p>
          <p>
            Contact your system administrator to create your account. For now, you can use test credentials if configured in your Supabase project.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
