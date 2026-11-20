import { performance } from 'perf_hooks';
import { AlternativeIndex, createAlternativeIndex } from './alternativeAnswers';
import { createEntryIndex, EntryIndex } from './dictionaryEntry';
import {
  createEnglishIndex,
  createSearchIndex,
  DictionaryEntry,
  EnglishIndex,
  SearchIndex,
} from './dictionarySearch';
import { logStructured } from './latency';

/**
 * The dictionary of one function instance, with each index built on its first
 * use (#498).
 *
 * Each `dictionary*` callable is a separate 1st gen function, so each one pays
 * its own cold start. Before #498 every one of them built every index. The
 * search index is the slowest (about 0.4 s of the 1 s local cold start), and
 * only `dictionarySearch` reads it. Its English part is a separate index,
 * built on the first English search or warm-up call only (#577).
 */
export interface DictionaryStore {
  characterIndexes(): CharacterIndexes;
  searchIndex(): SearchIndex;
  englishIndex(): EnglishIndex;
  entryIndex(): EntryIndex;
  alternativeIndex(): AlternativeIndex;
}

/** The entries by their simplified and by their traditional characters. */
export interface CharacterIndexes {
  simp: Map<string, DictionaryEntry[]>;
  trad: Map<string, DictionaryEntry[]>;
}

/** One stage of the load, written to the log when it ends. */
export interface LoadLine {
  stage:
    | 'entries'
    | 'character indexes'
    | 'search index'
    | 'english index'
    | 'entry index'
    | 'alternative index';
  ms: number;
}

export interface LoadOptions {
  log?: (line: LoadLine) => void;
  now?: () => number;
}

function createCharacterIndexes(entries: DictionaryEntry[]): CharacterIndexes {
  const indexes: CharacterIndexes = { simp: new Map(), trad: new Map() };
  for (const entry of entries) {
    for (const form of ['simp', 'trad'] as const) {
      const list = indexes[form].get(entry[form]);
      if (list) list.push(entry);
      else indexes[form].set(entry[form], [entry]);
    }
  }
  return indexes;
}

export function createDictionaryStore(
  readEntries: () => DictionaryEntry[],
  {
    log = (line) => logStructured('dictionary load', line),
    now = () => performance.now(),
  }: LoadOptions = {}
): DictionaryStore {
  /**
   * The value of `build`, made on the first call and kept for the instance. The
   * input comes first, so the time of a stage does not hold the file read.
   */
  function once<I, T>(stage: LoadLine['stage'], input: () => I, build: (input: I) => T): () => T {
    let value: T | undefined;
    let built = false;
    return () => {
      if (!built) {
        const source = input();
        const started = now();
        value = build(source);
        built = true;
        log({ stage, ms: Math.round(now() - started) });
      }
      return value as T;
    };
  }

  const entries = once('entries', () => undefined, readEntries);
  return {
    characterIndexes: once('character indexes', entries, createCharacterIndexes),
    searchIndex: once('search index', entries, createSearchIndex),
    englishIndex: once('english index', entries, createEnglishIndex),
    entryIndex: once('entry index', entries, createEntryIndex),
    alternativeIndex: once('alternative index', entries, createAlternativeIndex),
  };
}
