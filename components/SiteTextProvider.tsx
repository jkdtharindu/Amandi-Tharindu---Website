'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createT } from '@/src/site-text/siteTextRegistry.js';

type T = (key: string, vars?: Record<string, string | number | null | undefined>) => string;

// Without a provider (admin pages, tests) every lookup gives the default wording.
const SiteTextContext = createContext<T>(createT({}));

/**
 * Hands the admin-edited wording to client components. `texts` holds only the
 * edits; anything not edited falls back to the default wording.
 */
export function SiteTextProvider({ texts, children }: { texts: Record<string, string>; children: ReactNode }) {
  const t = useMemo(() => createT(texts), [texts]);
  return <SiteTextContext.Provider value={t}>{children}</SiteTextContext.Provider>;
}

/** t('rsvp.submit') or t('hero.flag', { weddingDate }) */
export function useSiteText(): T {
  return useContext(SiteTextContext);
}
