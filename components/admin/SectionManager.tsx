'use client';

import { useCallback, useEffect, useState } from 'react';

export type Section = {
  id: string;
  page: string;
  sectionType: string;
  title: string;
  content: string;
  displayOrder: number;
  isVisible: boolean;
};

const PAGE_LABELS: Record<string, string> = {
  home: 'Home',
  'our-story': 'Our Story',
  celebration: 'The Celebration',
  gallery: 'Gallery',
  wishes: 'Wishes',
};

type FormState = {
  page: string;
  sectionType: string;
  title: string;
  content: string;
};

const EMPTY_FORM: FormState = { page: 'home', sectionType: 'text', title: '', content: '' };

export default function SectionManager({
  initialSections,
  validPages,
  validSectionTypes,
}: {
  initialSections: Section[];
  validPages: string[];
  validSectionTypes: string[];
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, page: validPages[0] });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setMessage({ kind: 'error', text: 'Could not reach the server.' }));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (data.success) setSections(data.sections);
    } catch {
      setMessage({ kind: 'error', text: 'Could not load sections.' });
    }
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ kind: 'ok', text: 'Section added.' });
        setForm({ ...EMPTY_FORM, page: validPages[0] });
        await load();
        return;
      }
      setMessage({ kind: 'error', text: 'Could not add the section.' });
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleFieldSave(section: Section, patch: Partial<Section>) {
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/sections/' + section.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(patch),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSections((prev) => prev.map((s) => (s.id === section.id ? data.section : s)));
      } else {
        setMessage({ kind: 'error', text: 'Could not save that change.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(section: Section) {
    const confirmed = window.confirm(
      'Remove this ' + section.sectionType + ' section from ' + (PAGE_LABELS[section.page] || section.page) + '?'
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/sections/' + section.id, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSections((prev) => prev.filter((s) => s.id !== section.id));
        setMessage({ kind: 'ok', text: 'Section removed.' });
      } else {
        setMessage({ kind: 'error', text: 'Could not remove the section.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <p
          role="status"
          className={
            'mb-4 text-sm rounded-lg p-3 border ' +
            (message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200')
          }
        >
          {message.text}
        </p>
      )}

      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold mb-4">Add a section</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="new-page" className="block text-xs font-semibold text-slate-500 mb-1">
              Page
            </label>
            <select
              id="new-page"
              value={form.page}
              onChange={(e) => setForm({ ...form, page: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {validPages.map((page) => (
                <option key={page} value={page}>
                  {PAGE_LABELS[page] || page}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="new-type" className="block text-xs font-semibold text-slate-500 mb-1">
              Type
            </label>
            <select
              id="new-type"
              value={form.sectionType}
              onChange={(e) => setForm({ ...form, sectionType: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {validSectionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="new-title" className="block text-xs font-semibold text-slate-500 mb-1">
              Title <span className="font-normal">(optional)</span>
            </label>
            <input
              id="new-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="new-content" className="block text-xs font-semibold text-slate-500 mb-1">
              Content
            </label>
            <textarea
              id="new-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !csrfToken}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add section'}
        </button>
      </form>

      {sections.length === 0 ? (
        <p className="text-sm text-slate-500">No custom sections yet.</p>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              busy={busy}
              onSave={(patch) => handleFieldSave(section, patch)}
              onDelete={() => handleDelete(section)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionRow({
  section,
  busy,
  onSave,
  onDelete,
}: {
  section: Section;
  busy: boolean;
  onSave: (patch: Partial<Section>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const dirty = title !== section.title || content !== section.content;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {PAGE_LABELS[section.page] || section.page}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {section.sectionType}
          </span>
          <span
            className={
              'px-2 py-0.5 rounded-full text-xs font-semibold ' +
              (section.isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
            }
          >
            {section.isVisible ? 'Visible' : 'Hidden'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave({ isVisible: !section.isVisible })}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            {section.isVisible ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Content"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
      </div>

      {dirty && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave({ title, content })}
          className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          Save
        </button>
      )}
    </div>
  );
}
