/**
 * The search mode of the Add Words search (#577): how the dictionary reads a
 * Latin query. Chinese reads it as pinyin, English as an English meaning. A
 * hanzi query reads the same in both. The device keeps the last mode.
 */
export type SearchMode = 'chinese' | 'english';

const KEY = 'searchMode';

export const getSearchMode = (): SearchMode =>
  localStorage.getItem(KEY) === 'english' ? 'english' : 'chinese';

export const setSearchMode = (mode: SearchMode): void => localStorage.setItem(KEY, mode);
