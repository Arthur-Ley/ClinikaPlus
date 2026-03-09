export const GLOBAL_SEARCH_REFRESH_EVENT = 'global-search-refresh';

export function emitGlobalSearchRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_REFRESH_EVENT));
}

