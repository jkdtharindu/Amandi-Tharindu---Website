'use client';

import { useState } from 'react';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * A colour picker plus a hex text box. The picker alone (especially on phones)
 * can't take an exact code; the text box lets an admin paste one like #672942.
 */
export default function ColorField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  // While typing, the box may hold a half-finished code; it only updates the
  // real colour once the code is a complete #RRGGBB.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  function handleText(raw: string) {
    let next = raw.trim();
    if (next && !next.startsWith('#')) next = `#${next}`;
    setDraft(next);
    if (HEX_COLOR.test(next)) onChange(next.toUpperCase());
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => {
          setDraft(null);
          onChange(e.target.value);
        }}
        className="w-full h-10 rounded-lg border border-slate-300"
      />
      <input
        id={`${id}Hex`}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={7}
        aria-label={`${label} hex code`}
        value={shown}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => setDraft(null)}
        placeholder="#RRGGBB"
        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono uppercase"
      />
      {draft !== null && !HEX_COLOR.test(draft) && (
        <p className="mt-1 text-xs text-slate-500">Enter 6 characters, like #672942.</p>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
