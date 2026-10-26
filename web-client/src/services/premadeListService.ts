/**
 * The catalogue of premade lists, which `npm run build:dict` writes to
 * `public/premade-lists/` (see migration/premadeCatalogue.js).
 *
 * The index names each list and its size. Each list has a file of its own,
 * with the dictionary entries of its words: the dictionary is served by Cloud
 * Functions, so a list carries its entries, and adding it needs no lookup.
 * Nothing loads until the learner opens the catalogue.
 */

import { Word } from '../types/models';
import { retryTransient } from '../utils/retry';

/** An entry of the catalogue. Its name is domain data, not copy. */
export interface PremadeList {
  id: string;
  name: string;
  /** How many words the list has. */
  size: number;
}

const BASE_URL = '/premade-lists/';

async function loadJson<T>(file: string): Promise<T> {
  return retryTransient(async () => {
    const response = await fetch(`${BASE_URL}${file}`);
    if (!response.ok) throw new Error(`${file} returned ${response.status}`);
    return (await response.json()) as T;
  });
}

// A failed load is not kept, so the next call asks again.
let catalogue: Promise<PremadeList[]> | null = null;
const entries = new Map<string, Promise<Word[]>>();

/** The premade lists of the catalogue, in order. */
export function loadCatalogue(): Promise<PremadeList[]> {
  if (!catalogue) {
    catalogue = loadJson<{ lists: PremadeList[] }>('index.json').then(
      (index) => index.lists,
      (error) => {
        catalogue = null;
        throw error;
      },
    );
  }
  return catalogue;
}

/** The dictionary entries of the words of one premade list. */
export function loadPremadeEntries(listId: string): Promise<Word[]> {
  let loading = entries.get(listId);
  if (!loading) {
    loading = loadJson<Word[]>(`${listId}.json`).catch((error) => {
      entries.delete(listId);
      throw error;
    });
    entries.set(listId, loading);
  }
  return loading;
}
