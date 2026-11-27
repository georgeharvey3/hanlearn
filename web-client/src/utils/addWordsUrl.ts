/**
 * The search and the open word row of Add Words, kept in the URL. The page
 * replaces its history entry as they change, so back from the word page
 * returns to the same search, and a visit from the nav starts clean.
 */

export interface AddWordsView {
  query: string;
  open: number | null;
}

/** The search and the open row that a location search string holds. */
export function readAddWordsView(search: string): AddWordsView {
  const params = new URLSearchParams(search);
  const raw = params.get('open');
  const open = raw === null || raw === '' ? NaN : Number(raw);
  return {
    query: params.get('q') ?? '',
    open: Number.isInteger(open) ? open : null,
  };
}

/** The location search string of a view: empty when nothing is set. */
export function addWordsSearch({ query, open }: AddWordsView): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (open !== null) params.set('open', String(open));
  const text = params.toString();
  return text ? `?${text}` : '';
}
