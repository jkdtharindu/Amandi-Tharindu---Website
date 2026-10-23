'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Sends a person who opened a message link on to the site; crawlers stay and read the page's tags. */
export default function ShareForward({ coupleNames }: { coupleNames: string }) {
  useEffect(() => {
    window.location.replace('/');
  }, []);

  return (
    <main style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
      <p>{coupleNames}</p>
      <p>
        <Link href="/">Open the invitation</Link>
      </p>
    </main>
  );
}
