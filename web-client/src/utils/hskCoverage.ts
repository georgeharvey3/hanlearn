/**
 * The HSK coverage of the learner's collection: how the words of each HSK
 * level split into the words not added and the words at each level from 1 to
 * 5. See "HSK coverage" in CONTEXT.md.
 */

import { Word } from '../types/models';

/** One word of the HSK index: dictionary id, simplified, pinyin, list position. */
export type HskIndexRow = [id: number, simp: string, pinyin: string, list: number];

/**
 * The HSK index that `npm run build:dict` writes to
 * `public/premade-lists/hsk-index.json` (see migration/hskIndex.js). Each row
 * names its premade list by its position in `lists`.
 */
export interface HskIndex {
  lists: { id: string; name: string }[];
  words: HskIndexRow[];
}

export interface HskLevelCoverage {
  /** The premade list of the level, for example `hsk-3`. */
  listId: string;
  /** "HSK 3". Domain data, not copy. */
  name: string;
  total: number;
  notAdded: number;
  /** The words of the level in the collection, by their level 1 to 5. */
  levels: Record<number, number>;
}

/**
 * The coverage of each HSK level, in the order of the index. A collection
 * word matches an HSK word by the rule of `findInBank`: the same id, or the
 * same simplified characters and pinyin. So a word added by hand counts.
 */
export function hskCoverage(index: HskIndex, words: Word[]): HskLevelCoverage[] {
  const byId = new Map<number, Word>();
  const byForm = new Map<string, Word>();
  for (const word of words) {
    byId.set(word.id, word);
    byForm.set(`${word.simp} ${word.pinyin}`, word);
  }

  const coverage = index.lists.map((list) => ({
    listId: list.id,
    name: list.name,
    total: 0,
    notAdded: 0,
    levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
  }));

  for (const [id, simp, pinyin, list] of index.words) {
    const row = coverage[list];
    row.total += 1;
    const held = byId.get(id) ?? byForm.get(`${simp} ${pinyin}`);
    if (held) row.levels[held.level ?? 1] += 1;
    else row.notAdded += 1;
  }
  return coverage;
}
