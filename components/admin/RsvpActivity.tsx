'use client';

import { useEffect, useState } from 'react';

export type RsvpActivityItem = {
  id: string;
  personName: string;
  guestName: string;
  status: 'accepted' | 'declined';
  createdAt: string;
};

const SEEN_KEY = 'rsvp-activity-seen';
const BRIEF_COUNT = 3;

function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function Line({ item, now }: { item: RsvpActivityItem; now: number | null }) {
  const accepted = item.status === 'accepted';
  const sameAsGuest = item.personName === item.guestName;

  return (
    <li className="flex items-start gap-3 py-2">
      <span
        aria-hidden="true"
        className={
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
          (accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')
        }
      >
        {accepted ? '✓' : '✕'}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-slate-900">
          <span className="font-semibold">{item.personName}</span>{' '}
          {accepted ? 'accepted' : 'declined'}
          {!sameAsGuest && <span className="text-slate-500"> · {item.guestName}&apos;s invitation</span>}
        </p>
      </div>
      <span
        className="shrink-0 text-xs text-slate-400"
        title={new Date(item.createdAt).toLocaleString('en-GB')}
        suppressHydrationWarning
      >
        {now === null ? '' : timeAgo(item.createdAt, now)}
      </span>
    </li>
  );
}

/**
 * Dashboard card: a one-line summary of what changed since the admin last looked, the
 * latest few answers, and a button that opens the full history.
 */
export default function RsvpActivity({ items }: { items: RsvpActivityItem[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let seen = 0;
    try {
      seen = Number(window.localStorage.getItem(SEEN_KEY)) || 0;
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // Storage can be blocked; the card still works, it just cannot say "new".
    }
    const timer = setTimeout(() => {
      setLastSeen(seen);
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const fresh = lastSeen === null || lastSeen === 0 ? [] : items.filter((item) => new Date(item.createdAt).getTime() > lastSeen);
  const freshAccepted = fresh.filter((item) => item.status === 'accepted').length;
  const freshDeclined = fresh.length - freshAccepted;
  const shown = showAll ? items : items.slice(0, BRIEF_COUNT);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 mb-8" aria-label="Recent RSVP answers">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Recent RSVP answers</h2>
        {fresh.length > 0 && (
          <p className="text-sm font-semibold text-emerald-700" role="status">
            {fresh.length} new since your last visit: {freshAccepted} accepted · {freshDeclined} declined
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">No answers yet. New accepts and declines will show up here.</p>
      ) : (
        <>
          <ul className={'divide-y divide-slate-100 ' + (showAll ? 'max-h-96 overflow-y-auto' : '')}>
            {shown.map((item) => (
              <Line key={item.id} item={item} now={now} />
            ))}
          </ul>
          {items.length > BRIEF_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-2 text-sm font-semibold text-slate-700 underline hover:text-slate-900"
            >
              {showAll ? 'Show less' : `Show full history (${items.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
