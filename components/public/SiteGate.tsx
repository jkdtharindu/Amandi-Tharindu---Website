'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import EnvelopeReveal, { type InvitationCardSettings } from './EnvelopeReveal';

// Matches the envelope timeline in globals.css (`.envelope-*`), so the
// invitation page opens as the card finishes growing.
const REVEAL_MS = 2500;

type Revealed = { code: string; name: string };

function errorMessageFor(status: number): string {
  switch (status) {
    case 404:
      return "We couldn't find that code. Please check your invitation card and try again.";
    case 429:
      return 'Too many attempts. Please wait a few minutes, then try again.';
    case 403:
      return 'This page has been open a while. Please refresh it and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * The pre-login gate screen (PRD §15): the couple's names over a blurred,
 * drifting look-alike of the site, and one code field. The shapes behind the
 * names are decoration only — no real page content is ever rendered here, so
 * there is nothing to read out of the page source.
 */
export default function SiteGate({
  coupleNames,
  invitation,
}: {
  coupleNames: string;
  invitation: InvitationCardSettings;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const csrfToken = useRef('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => {
        csrfToken.current = data.token;
      })
      .catch(() => {
        // Fetched again on submit if this failed.
      });
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The sign-in cookie is already set by the login response, so proxy.ts
    // lets this navigation through to the real invitation page.
    const timer = setTimeout(
      () => router.push(`/invitation/${encodeURIComponent(revealed.code)}`),
      reduceMotion ? 0 : REVEAL_MS
    );
    return () => clearTimeout(timer);
  }, [revealed, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setError('Please enter the code printed on your invitation.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const refreshCsrfToken = async () => {
        const res = await fetch('/api/csrf');
        csrfToken.current = (await res.json()).token;
      };
      const attemptLogin = () =>
        fetch('/api/guest/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken.current },
          body: JSON.stringify({ code }),
        });

      if (!csrfToken.current) await refreshCsrfToken();
      let res = await attemptLogin();
      // /api/csrf issues a new token on every call, so the site open in a
      // second tab silently invalidates this one's. Fetch a fresh token and
      // retry once; the CSRF check runs before the rate limiter, so the
      // rejected attempt did not count against the guest.
      if (res.status === 403) {
        await refreshCsrfToken();
        res = await attemptLogin();
      }
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setRevealed({ code: data.code, name: data.name ?? '' });
        return;
      }
      setError(errorMessageFor(res.status));
    } catch {
      setError(errorMessageFor(0));
    } finally {
      setSubmitting(false);
    }
  }

  // "Tharindu & Amandi" -> three parts that fade in one after another.
  const nameParts = coupleNames.split(/\s*(&)\s*/).filter(Boolean);

  return (
    <main className="site-gate">
      <div className="gate-backdrop" aria-hidden="true">
        <div className="gate-ghost gate-ghost-hero" />
        <div className="gate-ghost gate-ghost-photo gate-ghost-photo-1" />
        <div className="gate-ghost gate-ghost-photo gate-ghost-photo-2" />
        <div className="gate-ghost gate-ghost-photo gate-ghost-photo-3" />
        <div className="gate-ghost gate-ghost-card gate-ghost-card-1" />
        <div className="gate-ghost gate-ghost-card gate-ghost-card-2" />
        <div className="gate-ghost gate-ghost-lines gate-ghost-lines-1" />
        <div className="gate-ghost gate-ghost-lines gate-ghost-lines-2" />
        <div className="gate-ghost gate-ghost-glow gate-ghost-glow-1" />
        <div className="gate-ghost gate-ghost-glow gate-ghost-glow-2" />
      </div>

      {revealed ? (
        <EnvelopeReveal guestName={revealed.name} coupleNames={coupleNames} invitation={invitation} />
      ) : (
        <div className="gate-panel">
          <h1 className="gate-names">
            {nameParts.map((part, index) => (
              <span
                key={`${part}-${index}`}
                className={part === '&' ? 'gate-names-amp' : 'gate-names-part'}
                style={{ animationDelay: `${0.25 + index * 0.45}s` }}
              >
                {part}
              </span>
            ))}
          </h1>
          <span className="gate-divider" aria-hidden="true" />

          <form className="gate-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="gate-code" className="sr-only">
              Invitation code
            </label>
            <input
              id="gate-code"
              name="code"
              type="text"
              className="gate-input"
              placeholder="Enter your invitation code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby="gate-error"
            />
            <button type="submit" className="gate-button" disabled={submitting}>
              {submitting ? 'Opening…' : 'Open'}
            </button>
            <p id="gate-error" className="gate-error" role="alert">
              {error}
            </p>
          </form>
        </div>
      )}
    </main>
  );
}
