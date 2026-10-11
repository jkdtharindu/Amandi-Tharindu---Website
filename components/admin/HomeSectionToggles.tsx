'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type HomeSection = { key: string; label: string };

/**
 * Show/hide switches for the built-in homepage sections. A hidden section
 * disappears from the guest homepage and from the guest menu, and comes back
 * the moment it is switched on again — nothing is deleted.
 */
export default function HomeSectionToggles({
  sections,
  initialVisibility,
}: {
  sections: HomeSection[];
  initialVisibility: Record<string, boolean>;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));
  }, [showToast]);

  async function toggle(section: HomeSection) {
    const next = !visibility[section.key];
    setBusyKey(section.key);
    try {
      const res = await fetch('/api/admin/home-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ key: section.key, isVisible: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVisibility((prev) => ({ ...prev, [section.key]: next }));
        showToast({ kind: 'ok', text: `${section.label} is now ${next ? 'shown' : 'hidden'} on the site.` });
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not save that change.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
      <h2 className="font-semibold mb-1">Homepage sections</h2>
      <p className="text-sm text-slate-500 mb-4">
        Hide a section until it is ready (for example, Gallery until the pre-shoot photos are uploaded).
        Guests will not see it or its menu link. Nothing is deleted.
      </p>
      <ul className="divide-y divide-slate-100">
        {sections.map((section) => {
          const shown = visibility[section.key] !== false;
          return (
            <li key={section.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm font-medium text-slate-800">{section.label}</span>
              <div className="flex items-center gap-3">
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
                  disabled={busyKey !== null || !csrfToken}
                  onClick={() => toggle(section)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {shown ? 'Hide' : 'Show'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
