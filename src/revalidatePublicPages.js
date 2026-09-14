import { revalidatePath } from 'next/cache';

/**
 * The public site statically prerenders theme/section/event data at build
 * time (no `dynamic`/`cookies()` opt-in), so without on-demand revalidation
 * an admin edit would only reach guests on the next `vercel deploy`. Call
 * this after any admin write that changes what it renders.
 *
 * Verified locally (self-hosted `next start --webpack`) that a literal
 * `revalidatePath('/page')` call actually regenerates the on-disk static
 * file on the next visit; `revalidatePath('/', 'layout')` did not, at least
 * under this project's Turbopack production build — use literal paths here
 * rather than the layout-wide form until that's understood.
 *
 * '/our-story', '/the-celebration', '/gallery', and '/wishes' are no longer
 * their own pages (Phase 6: folded into '/' as anchor sections, redirected
 * in next.config.ts) -- revalidating '/' covers all four.
 */
export function revalidateAllPublicPages() {
  revalidatePath('/');
}
