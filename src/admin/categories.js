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

/**
 * Custom groups (Action 84): the admin can type a new group while adding a
 * guest. There is no groups table — a custom group exists as long as a guest
 * carries it — so the pick-list is the built-in groups plus whatever the guests
 * already use, compared case-insensitively.
 */
export function mergeGroups(usedRelationships = []) {
  const groups = [...getCategories()];
  const seen = new Set(groups.map((g) => g.toLowerCase()));
  for (const raw of usedRelationships) {
    const group = String(raw ?? '').trim();
    if (group && !seen.has(group.toLowerCase())) {
      seen.add(group.toLowerCase());
      groups.push(group);
    }
  }
  return groups;
}
