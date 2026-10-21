/**
 * The active list, remembered on this device (issue #382).
 *
 * The value is per device, like the other session settings, so a list switch
 * costs no network write. The key does not hold the user ID: list IDs are
 * Firestore auto-IDs, so a list of a different account never matches, and the
 * stale-ID rule in the `addWords` reducer sends that case back to 'default'.
 */
export const ACTIVE_LIST_KEY = 'activeListId';

export const DEFAULT_LIST_ID = 'default';

/** The stored list ID, or 'default' when it is missing, empty or unreadable. */
export const readActiveList = (): string => {
  try {
    return localStorage.getItem(ACTIVE_LIST_KEY) || DEFAULT_LIST_ID;
  } catch {
    return DEFAULT_LIST_ID;
  }
};

export const writeActiveList = (listId: string): void => {
  try {
    localStorage.setItem(ACTIVE_LIST_KEY, listId);
  } catch {
    // Blocked storage, as in some private windows: the app forgets the list.
  }
};
