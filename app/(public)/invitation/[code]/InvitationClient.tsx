'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { useSiteText } from '@/components/SiteTextProvider';
import {
  approvedInvitees,
  buildResponses,
  choiceOf,
  countAnswered,
  countSavedAnswers,
  draftFromInvitee,
  draftsFor,
  isChanged,
  mergeFreshInvitees,
} from '@/src/rsvp/partyDrafts.js';

// After a saved RSVP the guest reads the thank-you pop-up, then lands on the
// home page (where the countdown runs).
const REDIRECT_HOME_MS = 2200;

/** Full-screen "saving" veil so a guest can see the RSVP is being processed. */
function SavingOverlay({ show }: { show: boolean }) {
  const t = useSiteText();
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm"
    >
      <span
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-current border-t-transparent"
        style={{ color: 'var(--color-accent)' }}
      />
      <p className="text-lg font-semibold" style={{ color: 'var(--color-brand)' }}>
        {t('rsvp.overlay')}
      </p>
    </div>
  );
}

export interface Invitee {
  id: string;
  name: string;
  rsvpStatus: 'pending' | 'accepted' | 'declined';
  addedBy: 'admin' | 'guest';
  approvalStatus: 'approved' | 'pending_approval' | 'rejected';
  displayOrder: number;
}

interface InvitationClientProps {
  guestCode: string;
  slotCount: number;
  hasResponded: boolean;
  currentRsvpStatus: string;
  coupleNames?: string;
  invitees?: Invitee[];
  weddingDate?: string;
}

export default function InvitationClient({
  guestCode,
  slotCount,
  hasResponded,
  currentRsvpStatus,
  coupleNames = "Amandi & Tharindu",
  invitees = [],
  weddingDate = "",
}: InvitationClientProps) {
  if (invitees.length > 0) {
    return <InviteeChecklist guestCode={guestCode} coupleNames={coupleNames} invitees={invitees} weddingDate={weddingDate} />;
  }

  return (
    <LegacyRsvpForm
      guestCode={guestCode}
      slotCount={slotCount}
      hasResponded={hasResponded}
      currentRsvpStatus={currentRsvpStatus}
      coupleNames={coupleNames}
      weddingDate={weddingDate}
    />
  );
}

function LegacyRsvpForm({
  guestCode,
  slotCount,
  hasResponded,
  currentRsvpStatus,
  coupleNames,
  weddingDate,
}: {
  guestCode: string;
  slotCount: number;
  hasResponded: boolean;
  currentRsvpStatus: string;
  coupleNames: string;
  weddingDate: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [attending, setAttending] = useState(currentRsvpStatus !== 'declined');
  const [participantNames, setParticipantNames] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const t = useSiteText();
  const [csrfToken, setCsrfToken] = useState<string>('');
  const showToast = useToast();

  useEffect(() => {
    // Fetch CSRF token on component mount
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => setCsrfToken(data.token))
      .catch(err => console.error('Failed to fetch CSRF token:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A double-tap must not send two requests (the server also guards this).
    if (submittingRef.current) return;

    if (attending && !participantNames.trim()) {
      showToast({ kind: 'error', text: 'Please enter participant names or decline if you are not attending.' });
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    let saved = false;
    try {
      const names = participantNames
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

      const res = await fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          code: guestCode,
          attending,
          participantNames: names,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        let msg: string;
        if (attending && weddingDate) {
          msg = t('rsvp.toastAccepted', { weddingDate });
        } else if (attending) {
          msg = t('rsvp.toastAcceptedNoDate');
        } else {
          msg = t('rsvp.toastDeclined');
        }
        saved = true;
        showToast({ kind: 'ok', text: msg });
        setTimeout(() => router.push('/'), REDIRECT_HOME_MS);
      } else {
        showToast({ kind: 'error', text: data.message || data.reason || 'Unable to save RSVP. Please try again.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      // Stay in the "saving" state once saved, until the home page opens.
      if (!saved) {
        submittingRef.current = false;
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <SavingOverlay show={loading} />
      {/* Sticky Bar */}
      {!hasResponded && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 px-4 py-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-gray-800 font-semibold">
              {t('legacy.stickyBar', { coupleNames })}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAttending(true);
                  setShowForm(true);
                }}
                className="py-2 px-6 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
              >
                {t('rsvp.accept')}
              </button>
              <button
                onClick={() => {
                  setAttending(false);
                  setShowForm(true);
                }}
                className="py-2 px-6 rounded-full bg-gray-500 text-white font-semibold hover:bg-gray-600 transition-colors"
              >
                {t('rsvp.decline')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Form - shown when user clicks Accept/Decline or wants to change */}
      {(showForm || hasResponded) && (
        <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-8 mb-20 md:mb-0">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            {hasResponded && !showForm ? t('legacy.formTitleDone') : t('legacy.formTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Attendance Radio */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="attending"
                  value="yes"
                  checked={attending}
                  onChange={(e) => setAttending(e.target.value === 'yes')}
                  className="w-4 h-4 text-green-600 cursor-pointer"
                />
                <span className="text-gray-900 font-semibold">{t('legacy.optionAttend')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="attending"
                  value="no"
                  checked={!attending}
                  onChange={(e) => setAttending(e.target.value === 'yes')}
                  className="w-4 h-4 text-red-600 cursor-pointer"
                />
                <span className="text-gray-900 font-semibold">{t('legacy.optionDecline')}</span>
              </label>
            </div>

            {/* Participant Names - shown only if attending */}
            {attending && (
              <div>
                <label htmlFor="participants" className="block text-sm font-semibold text-gray-700 mb-3">
                  Participant Names (comma-separated, {slotCount} available)
                </label>
                <textarea
                  id="participants"
                  value={participantNames}
                  onChange={(e) => setParticipantNames(e.target.value)}
                  placeholder={`e.g., ${['Nimal Silva', 'Anu Silva', 'Ravi Silva'].slice(0, slotCount).join(', ')}`}
                  disabled={!attending || loading}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] disabled:opacity-50"
                  rows={3}
                />
                <p className="text-sm text-gray-600 mt-2">
                  Please list all attendees from your party (up to {slotCount} people).
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="button button-primary w-full text-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? t('rsvp.submitBusy') : t('rsvp.submit')}
            </button>

            {/* Change Response Button - shown if already responded */}
            {hasResponded && !showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="button button-secondary w-full"
              >
                {t('legacy.changeButton')}
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * Per-person answers for a multi-person invitation with named invitees. Each
 * person answers on their own, at their own time: Save is available as soon as
 * one person has a new answer, only the people who changed are sent, and everyone
 * else stays as they were (usually "Awaiting response").
 */
function InviteeChecklist({
  guestCode,
  coupleNames,
  invitees,
  weddingDate,
}: {
  guestCode: string;
  coupleNames: string;
  invitees: Invitee[];
  weddingDate: string;
}) {
  // `saved` is the last thing the server told us; `drafts` is what is picked on
  // this page. Kept in one state so a refresh updates both at once.
  const [party, setParty] = useState(() => ({ saved: invitees, drafts: draftsFor(invitees) }));
  const approved = approvedInvitees(party.saved);
  const pendingRequests = party.saved.filter((invitee) => invitee.approvalStatus === 'pending_approval');

  const [newPersonName, setNewPersonName] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState('');
  const submittingRef = useRef(false);
  const partyRef = useRef(party);
  useEffect(() => {
    partyRef.current = party;
  }, [party]);
  const router = useRouter();
  const t = useSiteText();
  const [requesting, setRequesting] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch((err) => console.error('Failed to fetch CSRF token:', err));
  }, []);

  // Load the saved answers on arrival and whenever this tab comes back into
  // view, so answers another person saved from their own phone show up.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (submittingRef.current) return;
      setChecking(true);
      try {
        const res = await fetch('/api/guest/rsvp', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled || !res.ok || !data.success) return;
        const current = partyRef.current;
        const merged = mergeFreshInvitees(current.saved, current.drafts, data.invitees);
        setParty({ saved: data.invitees, drafts: merged.drafts });
        if (merged.changed) setNotice(t('rsvp.refreshed'));
      } catch {
        // Offline or a hiccup: keep showing what we have. Saving will say if it fails.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = buildResponses(approved, party.drafts);
  const total = approved.length;
  const respondedNow = countSavedAnswers(approved);
  const answeredAfterSave = countAnswered(approved, party.drafts);
  const canSave = entries.length > 0 && !saving;
  const saveHint =
    entries.length > 0 ? '' : answeredAfterSave === 0 ? t('rsvp.saveHintNone') : t('rsvp.saveHintNoChange');

  function pick(id: string, choice: 'accepted' | 'declined') {
    setThanks('');
    setParty((prev) => ({ ...prev, drafts: { ...prev.drafts, [id]: { ...prev.drafts[id], choice } } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // A double-tap must not send two requests (the server also guards this).
    if (submittingRef.current || entries.length === 0) return;

    submittingRef.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    setThanks('');
    let leaving = false;
    try {
      const res = await fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ code: guestCode, inviteeResponses: entries }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const conflicts: string[] = data.conflicts ?? [];
        const current = partyRef.current;
        const merged = mergeFreshInvitees(current.saved, current.drafts, data.invitees, { resetIds: conflicts });
        setParty({ saved: data.invitees, drafts: merged.drafts });

        const fresh = approvedInvitees(data.invitees);
        const stillPending = fresh.filter((invitee) => invitee.rsvpStatus === 'pending').length;
        if (conflicts.length > 0) setNotice(t('rsvp.conflict'));

        if (stillPending > 0) {
          setThanks(stillPending === 1 ? t('rsvp.thanksOneLeft') : t('rsvp.thanksSomeLeft', { pending: stillPending }));
        } else {
          const anyAccepted = fresh.some((invitee) => invitee.rsvpStatus === 'accepted');
          let text: string;
          if (anyAccepted && weddingDate) {
            text = t('rsvp.toastAccepted', { weddingDate });
          } else if (anyAccepted) {
            text = t('rsvp.toastAcceptedNoDate');
          } else {
            text = t('rsvp.toastDeclined');
          }
          // Everyone has answered: same hand-off to the home page as before.
          leaving = conflicts.length === 0;
          if (leaving) {
            showToast({ kind: 'ok', text });
            setTimeout(() => router.push('/'), REDIRECT_HOME_MS);
          } else {
            setThanks(text);
          }
        }
      } else {
        // Nothing the guest picked is cleared: the drafts stay as they were.
        setError(data.message || t('rsvp.errorSave'));
        if (data.reason === 'nothing_to_save') {
          const latest = await fetch('/api/guest/rsvp', { cache: 'no-store' }).then((r) => r.json());
          if (latest.success) {
            const current = partyRef.current;
            setParty({ saved: latest.invitees, drafts: mergeFreshInvitees(current.saved, current.drafts, latest.invitees).drafts });
          }
        }
      }
    } catch {
      setError(t('rsvp.errorSave'));
    } finally {
      // Stay in the "saving" state once everyone has answered, until the home page opens.
      if (!leaving) {
        submittingRef.current = false;
        setSaving(false);
      }
    }
  }

  async function handleRequestAddPerson() {
    const name = newPersonName.trim();
    if (!name) return;

    setRequesting(true);
    try {
      const res = await fetch('/api/guest/invitees/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ code: guestCode, name }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: t('rsvp.toastRequestSent', { coupleFirstName: coupleNames.split('&')[0].trim() || 'The couple' }) });
        setNewPersonName('');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not send that request.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-8">
      <SavingOverlay show={saving} />
      <h2 className="text-2xl font-bold mb-2 text-gray-900">{t('rsvp.title')}</h2>
      <p className="text-sm text-gray-600 mb-6">
        {t('rsvp.intro', { coupleNames })}
      </p>

      <p className="text-sm font-semibold text-gray-800 mb-1" data-testid="rsvp-progress">
        {t('rsvp.progress', { answered: respondedNow, total })}
      </p>
      <p className="text-xs text-gray-500 mb-4 min-h-4" aria-live="polite">
        {checking ? t('rsvp.checking') : ''}
      </p>

      {notice && (
        <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {approved.map((invitee) => {
          const draft = party.drafts[invitee.id] ?? draftFromInvitee(invitee);
          const savedChoice = choiceOf(invitee.rsvpStatus);
          const unsaved = isChanged(invitee, draft);
          const badge =
            savedChoice === 'accepted'
              ? { text: t('rsvp.badgeAttending'), cls: 'bg-green-100 text-green-800' }
              : savedChoice === 'declined'
                ? { text: t('rsvp.badgeDeclined'), cls: 'bg-gray-200 text-gray-800' }
                : { text: t('rsvp.badgeWaiting'), cls: 'bg-amber-100 text-amber-800' };
          const options: { value: 'accepted' | 'declined'; label: string }[] = [
            { value: 'accepted', label: t('rsvp.choiceAttending') },
            { value: 'declined', label: t('rsvp.choiceDeclined') },
          ];

          return (
            <fieldset key={invitee.id} className="border border-gray-200 rounded-2xl px-4 py-3">
              <legend className="sr-only">{invitee.name}</legend>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="font-semibold text-gray-900">{invitee.name}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
                {savedChoice && <span className="text-xs text-gray-600">{t('rsvp.confirmed')}</span>}
                {unsaved && <span className="text-xs font-semibold text-amber-700">{t('rsvp.unsaved')}</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-gray-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--color-accent)] ${
                      draft.choice === option.value ? 'border-gray-900 bg-gray-50 font-semibold' : 'border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`rsvp-${invitee.id}`}
                      value={option.value}
                      checked={draft.choice === option.value}
                      onChange={() => pick(invitee.id, option.value)}
                      disabled={saving}
                      className="h-5 w-5 shrink-0 cursor-pointer"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}

        {pendingRequests.map((invitee) => (
          <div
            key={invitee.id}
            className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 rounded-2xl px-4 py-3"
          >
            <span className="font-semibold text-gray-700">{invitee.name}</span>
            <span className="text-xs font-semibold text-amber-700">{t('rsvp.pendingApproval')}</span>
          </div>
        ))}

        <button
          type="submit"
          disabled={!canSave}
          aria-describedby="rsvp-save-hint"
          className="button button-primary w-full min-h-12 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? t('rsvp.submitBusy') : t('rsvp.saveButton', { answered: answeredAfterSave, total })}
        </button>
        <p id="rsvp-save-hint" className="text-sm text-gray-600 min-h-5">
          {canSave || saving ? '' : saveHint}
        </p>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>

      {/* Always on the page so a screen reader announces the message when it appears. */}
      <div role="status" aria-live="polite" data-testid="rsvp-thanks">
        {thanks && (
          <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">{thanks}</p>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <label htmlFor="newPerson" className="block text-sm font-semibold text-gray-700 mb-2">
          {t('rsvp.addPrompt')}
        </label>
        <div className="flex gap-2">
          <input
            id="newPerson"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder={t('rsvp.addPlaceholder')}
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
          />
          <button
            type="button"
            onClick={handleRequestAddPerson}
            disabled={requesting || !newPersonName.trim()}
            className="button button-secondary disabled:opacity-50"
          >
            {requesting ? t('rsvp.addBusy') : t('rsvp.addButton')}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {t('rsvp.addNote')}
        </p>
      </div>
    </div>
  );
}
