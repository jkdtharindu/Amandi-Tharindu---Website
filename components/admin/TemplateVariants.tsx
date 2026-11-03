'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import type { MessageTemplate } from './MessagingCenter';

type Variant = { variant: number; name: string; body: string; groups: string[] };

/**
 * Switches between the several wordings a level can keep (the Main invitation keeps up
 * to 4) and links the open one to guest groups. A guest gets the wording linked to their
 * group; a group linked to none gets template 1. A group belongs to one wording only:
 * ticking it here takes it off the others (the server does that).
 */
export default function TemplateVariants({
  levelKey,
  levelLabel,
  variants,
  openVariant,
  maxTemplates,
  categories,
  csrfToken,
  onOpen,
  onAdded,
  onRemoved,
  onTemplates,
}: {
  levelKey: string;
  levelLabel: string;
  variants: Variant[];
  openVariant: number;
  maxTemplates: number;
  categories: string[];
  csrfToken: string;
  onOpen: (variant: number) => void;
  onAdded: (variant: number, body: string) => void;
  onRemoved: (variant: number) => void;
  onTemplates: (templates: MessageTemplate[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const showToast = useToast();

  const open = variants.find((entry) => entry.variant === openVariant) ?? variants[0];
  const nextNumber = Array.from({ length: maxTemplates }, (_, index) => index + 1).find(
    (number) => !variants.some((entry) => entry.variant === number)
  );

  async function call(method: 'PUT' | 'PATCH' | 'DELETE', payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/message-templates', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ levelKey, ...payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({ kind: 'error', text: data.message || 'Could not save the change.' });
        return null;
      }
      return data;
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server.' });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate() {
    if (!nextNumber) return;
    // A new wording starts as a copy of template 1, ready to edit.
    const body = variants[0].body;
    if (await call('PUT', { variant: nextNumber, body })) onAdded(nextNumber, body);
  }

  async function removeTemplate() {
    if (open.variant < 2) return;
    if (await call('DELETE', { variant: open.variant })) {
      onRemoved(open.variant);
      showToast({ kind: 'ok', text: `Removed template ${open.variant}. Its groups now get template 1.` });
    }
  }

  async function toggleGroup(group: string) {
    const has = open.groups.some((entry) => entry.toLowerCase() === group.toLowerCase());
    const groups = has
      ? open.groups.filter((entry) => entry.toLowerCase() !== group.toLowerCase())
      : [...open.groups, group];
    const data = await call('PATCH', { variant: open.variant, groups });
    if (data) onTemplates(data.templates);
  }

  const groupOwner = (group: string) =>
    variants.find((entry) => entry.groups.some((linked) => linked.toLowerCase() === group.toLowerCase()));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-semibold">{levelLabel} templates</h2>
        {variants.map((entry) => (
          <button
            key={entry.variant}
            type="button"
            onClick={() => onOpen(entry.variant)}
            aria-pressed={entry.variant === open.variant}
            className={
              'px-3 py-1.5 rounded-lg border text-sm font-medium ' +
              (entry.variant === open.variant
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 hover:bg-slate-50')
            }
          >
            Template {entry.variant}
            {entry.groups.length > 0 && (
              <span className="ml-1 text-xs opacity-70">({entry.groups.length})</span>
            )}
          </button>
        ))}
        {nextNumber && (
          <button
            type="button"
            onClick={addTemplate}
            disabled={busy || !csrfToken}
            className="px-3 py-1.5 rounded-lg border border-dashed border-slate-400 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            + Add template
          </button>
        )}
        {open.variant > 1 && (
          <button
            type="button"
            onClick={removeTemplate}
            disabled={busy || !csrfToken}
            className="ml-auto text-xs text-rose-700 underline hover:text-rose-900 disabled:opacity-50"
          >
            Remove template {open.variant}
          </button>
        )}
      </div>

      <fieldset className="mt-3" disabled={busy || !csrfToken}>
        <legend className="text-xs font-semibold text-slate-500">
          Send template {open.variant} to these groups
        </legend>
        {categories.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No guest groups yet.</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {categories.map((group) => {
              const owner = groupOwner(group);
              const here = owner?.variant === open.variant;
              return (
                <label key={group} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={here}
                    onChange={() => toggleGroup(group)}
                    className="rounded border-slate-300"
                  />
                  {group}
                  {owner && !here && (
                    <span className="text-xs text-slate-400">(template {owner.variant})</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          A group is sent one template only. Groups not ticked anywhere get template 1.
        </p>
      </fieldset>
    </div>
  );
}
