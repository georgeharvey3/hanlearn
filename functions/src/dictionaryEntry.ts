import { DictionaryEntry, WordResult } from './dictionarySearch';

/** The entries of the dictionary by their id. */
export type EntryIndex = Map<number, DictionaryEntry>;

export function createEntryIndex(entries: DictionaryEntry[]): EntryIndex {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/**
 * The entry with the id, as the client reads it, or null when no entry has
 * the id. A custom word has a negative id, so it never has an entry.
 */
export function entryById(index: EntryIndex, id: number): WordResult | null {
  const entry = index.get(id);
  if (!entry) return null;
  return {
    id: entry.id,
    simp: entry.simp,
    trad: entry.trad,
    pinyin: entry.pinyin,
    meaning: entry.meaning,
  };
}
