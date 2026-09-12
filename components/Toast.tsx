'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'ok' | 'error';
export type ToastInput = { kind: ToastKind; text: string };

type ToastItem = ToastInput & { id: number };

const AUTO_DISMISS_MS = 5000;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * App-wide toast notifications. Mounted once in the root layout so any page
 * can call useToast() without its own provider or portal.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ kind, text }: ToastInput) => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, kind, text }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={
              'toast-item flex items-start gap-3 rounded-lg border p-3 text-sm shadow-lg ' +
              (toast.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200')
            }
          >
            <p className="flex-1">{toast.text}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 leading-none text-lg opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns a function to show a toast: showToast({ kind: 'ok', text: '...' }). */
export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return showToast;
}
