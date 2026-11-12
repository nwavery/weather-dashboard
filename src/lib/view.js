// ?view=card: one card filling its frame, for embedding (the Avery Home fridge
// dashboard shows it in an iframe on its Weather page). Anything else, or no
// view at all, is the normal dashboard. The match is exact and lower case, so
// a typo falls back to the dashboard rather than to something in between.

export function viewFromSearch(search) {
  try {
    return new URLSearchParams(search || '').get('view') === 'card' ? 'card' : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

// Read once at load, like the ?city= pin: the view never changes in a page's life.
export const IS_CARD_VIEW = typeof window !== 'undefined' && viewFromSearch(window.location?.search) === 'card';
