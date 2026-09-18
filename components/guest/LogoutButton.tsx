'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const showToast = useToast();

  /**
   * A failed sign-out must say so (Next Action 31). This previously sent
   * failures to console.error and otherwise did nothing visible, so a guest on
   * a shared family phone could tap "Logout", see the button settle back to
   * normal, and walk away still signed in — handing the next person their RSVP.
   */
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const { token } = await fetch('/api/csrf').then((res) => res.json());
      const response = await fetch('/api/guest/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
      });

      if (!response.ok) {
        showToast({ kind: 'error', text: 'Could not sign out. Please try again.' });
        return;
      }

      router.push('/login');
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server to sign out.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
