'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type HomePart = { key: string; label: string };
type HomeSection = { key: string; label: string; parts: HomePart[] };

/**
 * Controls for the built-in homepage sections:
 *  - Hide/Show a whole section (it also leaves the guest menu),
 *  - Hide/Show the parts inside it (small label, heading, paragraph, ...),
 *  - Move a section up or down (the guest page and menu follow the same order).
 * Nothing is deleted; switching a part or section back on restores it.
 */
export default function HomeSectionToggles({
  sections,
  initialVisibility,
  initialPartVisibility,
  initialOrder,
}: {
  sections: HomeSection[];
  initialVisibility: Record<string, boolean>;
  initialPartVisibility: Record<string, boolean>;
  initialOrder: string[];
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [partVisibility, setPartVisibility] = useState(initialPartVisibility);
  const [order, setOrder] = useState(initialOrder);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));
  }, [showToast]);

  const byKey = new Map(sections.map((section) => [section.key, section]));
  const ordered = order.map((key) => byKey.get(key)).filter((s): s is HomeSection => Boolean(s));

  async function save(body: object, busy: string): Promise<boolean> {
    setBusyKey(busy);
    try {
      const res = await fetch('/api/admin/home-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) return true;
      showToast({ kind: 'error', text: data.message || 'Could not save that change.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusyKey(null);
    }
    return false;
  }

  async function toggleSection(section: HomeSection) {
    const next = visibility[section.key] === false;
    if (await save({ key: section.key, isVisible: next }, section.key)) {
      setVisibility((prev) => ({ ...prev, [section.key]: next }));
      showToast({ kind: 'ok', text: `${section.label} is now ${next ? 'shown' : 'hidden'} on the site.` });
    }
  }

  async function togglePart(section: HomeSection, part: HomePart) {
    const key = `${section.key}:${part.key}`;
    const next = partVisibility[key] === false;
    if (await save({ key, isVisible: next }, key)) {
      setPartVisibility((prev) => ({ ...prev, [key]: next }));
      showToast({ kind: 'ok', text: `${section.label} – ${part.label} is now ${next ? 'shown' : 'hidden'}.` });
    }
  }

  async function move(section: HomeSection, direction: -1 | 1) {
    const from = order.indexOf(section.key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    if (await save({ order: next }, `move:${section.key}`)) {
      setOrder(next);
      showToast({ kind: 'ok', text: `${section.label} moved ${direction < 0 ? 'up' : 'down'}.` });
    }
  }

  const locked = busyKey !== null || !csrfToken;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
      <h2 className="font-semibold mb-1">Homepage sections</h2>
      <p className="text-sm text-slate-500 mb-4">
        The top banner with the countdown always stays first. Use <strong>Move up / Move down</strong> to
        change the order of the sections below it (the guest menu follows the same order). Hide a section
        until it is ready, or open <strong>Parts</strong> to hide only some of it, for example the story
        cards. Guests will not see hidden items. Nothing is deleted.
      </p>
      <ul className="divide-y divide-slate-100">
        {ordered.map((section, index) => {
          const shown = visibility[section.key] !== false;
          return (
            <li key={section.key} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-800">
                  {index + 1}. {section.label}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      'px-2 py-0.5 rounded-full text-xs font-semibold ' +
                      (shown ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
                    }
                  >
                    {shown ? 'Visible' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    disabled={locked || index === 0}
                    onClick={() => move(section, -1)}
                    aria-label={`Move ${section.label} up`}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={locked || index === ordered.length - 1}
                    onClick={() => move(section, 1)}
                    aria-label={`Move ${section.label} down`}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => toggleSection(section)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    {shown ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              {section.parts.length > 0 && (
                <details className="mt-2 ml-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600">Parts</summary>
                  <ul className="mt-2 space-y-1.5">
                    {section.parts.map((part) => {
                      const key = `${section.key}:${part.key}`;
                      const partShown = partVisibility[key] !== false;
                      return (
                        <li key={key} className="flex items-center justify-between gap-3 pl-2">
                          <span className="text-sm text-slate-700">{part.label}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                'px-2 py-0.5 rounded-full text-xs font-semibold ' +
                                (partShown ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
                              }
                            >
                              {partShown ? 'Visible' : 'Hidden'}
                            </span>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => togglePart(section, part)}
                              aria-label={`${partShown ? 'Hide' : 'Show'} ${part.label} in ${section.label}`}
                              className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                            >
                              {partShown ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
