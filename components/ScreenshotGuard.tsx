'use client';

import { useEffect } from 'react';

/**
 * Best-effort deterrent against screenshots and copying.
 *
 * A website can never fully stop screenshots (a phone camera or OS tool
 * always works). This makes it hard for casual users: it blocks right-click,
 * drag, copy, save/print shortcuts and the PrintScreen key, and hides the
 * page when the tab is switched away or on a screenshot key press.
 */
const HIDDEN_CLASS = 'screenshot-guard-hidden';

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
}

export default function ScreenshotGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const hide = () => root.classList.add(HIDDEN_CLASS);
    const show = () => root.classList.remove(HIDDEN_CLASS);

    const blockUnlessEditable = (event: Event) => {
      if (!isEditable(event.target)) event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (key === 'printscreen' || event.code === 'PrintScreen') {
        event.preventDefault();
        hide();
        try {
          void navigator.clipboard?.writeText('Screenshots are not allowed.');
        } catch {
          /* clipboard may be blocked; ignore */
        }
        window.setTimeout(show, 1500);
        return;
      }

      // Mac screenshot shortcuts: Cmd+Shift+3/4/5
      if (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key)) {
        hide();
        window.setTimeout(show, 1500);
      }

      // Save, print, view source, copy-all/copy, devtools
      if (mod && ['s', 'p', 'u'].includes(key)) event.preventDefault();
      if (mod && !isEditable(event.target) && ['c', 'x', 'a'].includes(key)) {
        event.preventDefault();
      }
      if (key === 'f12' || (mod && event.shiftKey && ['i', 'j', 'c'].includes(key))) {
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'PrintScreen') {
        try {
          void navigator.clipboard?.writeText('Screenshots are not allowed.');
        } catch {
          /* ignore */
        }
      }
    };

    const onVisibility = () => (document.hidden ? hide() : show());

    document.addEventListener('contextmenu', blockUnlessEditable);
    document.addEventListener('dragstart', blockUnlessEditable);
    document.addEventListener('copy', blockUnlessEditable);
    document.addEventListener('cut', blockUnlessEditable);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeprint', hide);
    window.addEventListener('afterprint', show);

    return () => {
      document.removeEventListener('contextmenu', blockUnlessEditable);
      document.removeEventListener('dragstart', blockUnlessEditable);
      document.removeEventListener('copy', blockUnlessEditable);
      document.removeEventListener('cut', blockUnlessEditable);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeprint', hide);
      window.removeEventListener('afterprint', show);
      show();
    };
  }, []);

  return null;
}
