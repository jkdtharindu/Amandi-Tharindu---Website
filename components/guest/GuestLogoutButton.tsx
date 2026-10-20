'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { useSiteText } from '@/components/SiteTextProvider';

/**
 * Signs the guest out of this browser, so the next person sharing the phone
 * can open their own invitation. Calls the same guest logout route the old
 * server used; it only clears the guest_session cookie.
 */
export default function GuestLogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const t = useSiteText();
  const showToast = useToast();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { token } = await fetch('/api/csrf').then((res) => res.json());
      const res = await fetch('/api/guest/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
      });

      if (!res.ok) {
        showToast({ kind: 'error', text: 'Could not log out. Please try again.' });
        setLoggingOut(false);
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server to log out.' });
      setLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="button button-secondary w-full disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {t('invitation.logout')}
    </button>
  );
}
