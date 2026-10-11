'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';

type Field = {
  key: string;
  group: string;
  label: string;
  defaultText: string;
  multiline: boolean;
  tags: string[];
};

/**
 * Admin > Site wording: every piece of wording guests can see, grouped by where
 * it appears. Each box starts with what the site shows now; changing it and
 * pressing Save replaces it on the site, and "Use original wording" puts the
 * original text back. Names and dates inside {curly brackets} are filled in
 * automatically — keep them where they should appear.
 */
export default function SiteWordingEditor({
  fields,
  groups,
  initialOverrides,
  maxLength,
}: {
  fields: Field[];
  groups: string[];
  initialOverrides: Record<string, string>;
  maxLength: number;
}) {
  const effective = (overrides: Record<string, string>) =>
    Object.fromEntries(fields.map((f) => [f.key, overrides[f.key] ?? f.defaultText]));

  const [saved, setSaved] = useState<Record<string, string>>(() => effective(initialOverrides));
  const [values, setValues] = useState<Record<string, string>>(() => effective(initialOverrides));
  const [saving, setSaving] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));
  }, [showToast]);

  const changedKeys = useMemo(
    () => fields.filter((f) => values[f.key].trim() !== saved[f.key]).map((f) => f.key),
    [fields, values, saved]
  );

  async function handleSave() {
    setSaving(true);
    try {
      const payload = Object.fromEntries(changedKeys.map((key) => [key, values[key]]));
      const res = await fetch('/api/admin/site-text', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ values: payload }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const next = { ...saved };
        const nextValues = { ...values };
        for (const key of changedKeys) {
          const field = fields.find((f) => f.key === key)!;
          const trimmed = values[key].trim();
          // Empty text means "use the original wording".
          next[key] = trimmed === '' ? field.defaultText : trimmed;
          nextValues[key] = next[key];
        }
        setSaved(next);
        setValues(nextValues);
        showToast({ kind: 'ok', text: 'Wording saved. Guests will see it now.' });
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not save the wording.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="space-y-4">
        {groups.map((group) => {
          const groupFields = fields.filter((f) => f.group === group);
          const editedCount = groupFields.filter((f) => saved[f.key] !== f.defaultText).length;
          return (
            <details key={group} className="bg-white rounded-xl border border-slate-200">
              <summary className="cursor-pointer select-none px-5 py-3 font-semibold flex items-center justify-between gap-3">
                <span>{group}</span>
                <span className="text-xs font-normal text-slate-500">
                  {groupFields.length} texts{editedCount > 0 ? ` · ${editedCount} changed` : ''}
                </span>
              </summary>
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                {groupFields.map((field) => {
                  const id = `wording-${field.key}`;
                  const value = values[field.key];
                  const isDefault = value.trim() === field.defaultText;
                  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm';
                  return (
                    <div key={field.key}>
                      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 mb-1">
                        {field.label}
                      </label>
                      {field.multiline ? (
                        <textarea
                          id={id}
                          rows={3}
                          maxLength={maxLength}
                          value={value}
                          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          id={id}
                          maxLength={maxLength}
                          value={value}
                          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                          className={inputClass}
                        />
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {field.tags.length > 0 && (
                          <span>
                            Filled in automatically: {field.tags.join(', ')} — keep it where it should appear.
                          </span>
                        )}
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => setValues({ ...values, [field.key]: field.defaultText })}
                            className="font-semibold text-slate-700 underline"
                          >
                            Use original wording
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">
            {changedKeys.length === 0
              ? 'No unsaved changes.'
              : `${changedKeys.length} unsaved change${changedKeys.length === 1 ? '' : 's'}.`}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !csrfToken || changedKeys.length === 0}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save wording'}
          </button>
        </div>
      </div>
    </div>
  );
}
