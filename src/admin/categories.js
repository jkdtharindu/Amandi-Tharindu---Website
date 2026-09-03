/**
 * Guest relationship/group categories.
 *
 * Customize by setting GUEST_CATEGORIES environment variable:
 *   export GUEST_CATEGORIES="Relations,Colleagues,Neighbours,Friends,Family"
 *
 * Used for code generation (first 3 letters) and admin UI filtering.
 */

const DEFAULT_CATEGORIES = ['Relations', 'Colleagues', 'Neighbours', 'Friends'];

export function getCategories() {
  const env = process.env.GUEST_CATEGORIES || '';
  if (env.trim()) {
    return env.split(',').map((c) => c.trim()).filter(Boolean);
  }
  return DEFAULT_CATEGORIES;
}

export function validateCategory(category) {
  const valid = getCategories();
  return valid.includes(category);
}
