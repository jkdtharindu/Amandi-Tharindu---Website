'use client';

import { useEffect, useState } from 'react';
import SharePhoto from './SharePhoto';

/** The Theme page's WhatsApp preview photo card: fetches its own CSRF token and holds the current picture. */
export default function ShareImageCard({ prompt, initialImageUrl }: { prompt: string; initialImageUrl: string | null }) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => {
        // The upload buttons stay disabled until a token arrives.
      });
  }, []);

  return <SharePhoto prompt={prompt} imageUrl={imageUrl} csrfToken={csrfToken} onChanged={setImageUrl} />;
}
