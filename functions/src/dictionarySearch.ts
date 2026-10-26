/**
 * The search of the Add Words screen: one query in hanzi, pinyin or English,
 * and one ranked list of entries back. See issue #425.
 *
 * Pure: dictionary.ts loads the entries and builds the index once per
 * instance, and the callable asks it.
 */

export interface DictionaryEntry {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
  /** The frequency rank of the HSK source, for the HSK words only. */
  q?: number;
}

export interface WordResult {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

/** The most results that one search gives. There is no paging. */
const SEARCH_LIMIT = 30;

/** The tiers of the ranking, best first. */
const enum Tier {
  ExactHanzi,
  HanziPrefix,
  FullPinyin,
  PartialPinyin,
  Initials,
  GlossEquals,
  GlossStarts,
  GlossHolds,
  CrossReference,
}

/**
 * The words of a gloss or of an English query, for a match of whole words:
 * case, text in parentheses and a leading "to " do not count, so "eat" matches
 * "to eat (a meal)".
 */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .replace(/^to\s+/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** A gloss that only points to another entry, such as "see 大衛" or "old variant of 吃". */
const CROSS_REFERENCE = /^(see\b|([a-z]+ )?variant of\b)/i;

/**
 * The glosses of an entry: each `/`-separated sense in CC-CEDICT, and each
 * `;`-separated gloss inside a sense, as in "to eat; to consume". Without the
 * second split, "eat" would not be equal to a gloss of 吃.
 */
const glossesOf = (entry: DictionaryEntry) => entry.meaning.split(/[/;]/);

/** Where the query words sit in the gloss words, as a tier, or null. */
function glossTier(gloss: string[], query: string[]): Tier | null {
  for (let start = 0; start + query.length <= gloss.length; start++) {
    if (query.every((word, i) => gloss[start + i] === word)) {
      if (start > 0) return Tier.GlossHolds;
      return gloss.length === query.length ? Tier.GlossEquals : Tier.GlossStarts;
    }
  }
  return null;
}

const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ffff}]/u;

/** One syllable of an entry: its letters, with ü as v, and its tone, 5 for neutral. */
interface Syllable {
  letters: string;
  tone: number;
}

/**
 * The syllables of a CC-CEDICT pinyin such as "Zhong1 guo2" or "nu:3". A
 * syllable with no digit, such as a Latin letter in "A A zhi4", is neutral.
 * Tokens with no letter, such as "," or "·", are not syllables.
 */
function syllablesOf(pinyin: string): Syllable[] {
  const syllables: Syllable[] = [];
  for (const token of pinyin.toLowerCase().replace(/u:/g, 'v').split(' ')) {
    const match = /^([a-zv]+)([1-5]?)$/.exec(token);
    if (match) syllables.push({ letters: match[1], tone: Number(match[2] || 5) });
  }
  return syllables;
}

/** A bare u also matches ü, because phone keyboards hide ü: the keys fold ü to u. */
const fold = (letters: string) => letters.replace(/v/g, 'u');

/** The tone that a tone mark gives, and its vowel. */
const TONE_MARKS: Record<string, [string, number]> = {};
for (const [vowel, marks] of Object.entries({
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  v: 'ǖǘǚǜ',
})) {
  [...marks].forEach((mark, i) => (TONE_MARKS[mark] = [vowel, i + 1]));
}

/**
 * A tone in the query. A tone mark gives the tone of the syllable that holds
 * the letter at `at`; a tone digit gives the tone of the syllable that ends
 * just before `at`.
 */
interface ToneOfQuery {
  at: number;
  tone: number;
  digit: boolean;
}

/** A Latin query read as pinyin. */
interface PinyinQuery {
  /** The letters with ü as v, with no spaces or apostrophes. */
  letters: string;
  tones: ToneOfQuery[];
}

/**
 * Read a query as pinyin: ü, v and u: are one letter, 5 and 0 are the neutral
 * tone, and spaces, apostrophes and case do not count. Null when the query
 * holds anything else.
 */
function readPinyin(query: string): PinyinQuery | null {
  const text = query.normalize('NFC').toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v');
  let letters = '';
  const tones: ToneOfQuery[] = [];
  for (const char of text) {
    if (char === ' ' || char === "'" || char === '’') continue;
    if (/[a-z]/.test(char)) {
      letters += char;
    } else if (TONE_MARKS[char]) {
      const [vowel, tone] = TONE_MARKS[char];
      tones.push({ at: letters.length, tone, digit: false });
      letters += vowel;
    } else if (/[0-5]/.test(char)) {
      const last = tones[tones.length - 1];
      if (!letters || (last?.digit && last.at === letters.length)) return null;
      tones.push({ at: letters.length, tone: char === '0' ? 5 : Number(char), digit: true });
    } else {
      return null;
    }
  }
  return letters ? { letters, tones } : null;
}

/** Whether the syllables of an entry agree with the tones and the ü of a query. */
function agrees(syllables: Syllable[], query: PinyinQuery): boolean {
  const spelled = syllables.map((s) => s.letters).join('');
  for (let i = 0; i < query.letters.length; i++) {
    if (query.letters[i] === 'v' && spelled[i] !== 'v') return false;
  }
  return query.tones.every(({ at, tone, digit }) => {
    let start = 0;
    for (const syllable of syllables) {
      const end = start + syllable.letters.length;
      const holds = digit ? end === at : at >= start && at < end;
      if (holds) return syllable.tone === tone;
      start = end;
    }
    return false;
  });
}

/** Keys in sorted order, so the keys that start with a prefix are one run. */
interface SortedKeys {
  keys: string[];
  entries: number[];
}

export interface SearchIndex {
  entries: DictionaryEntry[];
  simp: SortedKeys;
  trad: SortedKeys;
  /** The toneless, spaceless pinyin of each entry, with ü folded to u. */
  pinyin: SortedKeys;
  /** The first letters of the syllables of each entry, with ü folded to u. */
  initials: Map<string, number[]>;
  /** The entries whose glosses hold each word. */
  glossWords: Map<string, number[]>;
}

function sortedKeys(
  entries: DictionaryEntry[],
  keyOf: (entry: DictionaryEntry, i: number) => string,
) {
  const order = entries.map((_, i) => i);
  const keys = entries.map(keyOf);
  order.sort((a, b) => (keys[a] < keys[b] ? -1 : keys[a] > keys[b] ? 1 : a - b));
  return { keys: order.map((i) => keys[i]), entries: order };
}

/** The entries whose key starts with the prefix, in no particular order. */
function withPrefix(sorted: SortedKeys, prefix: string): number[] {
  let lo = 0;
  let hi = sorted.keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted.keys[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const found: number[] = [];
  for (let i = lo; i < sorted.keys.length && sorted.keys[i].startsWith(prefix); i++) {
    found.push(sorted.entries[i]);
  }
  return found;
}

export function createSearchIndex(entries: DictionaryEntry[]): SearchIndex {
  const initials = new Map<string, number[]>();
  const glossWords = new Map<string, number[]>();
  const pinyinKeys: string[] = [];
  entries.forEach((entry, i) => {
    const syllables = syllablesOf(entry.pinyin);
    pinyinKeys.push(fold(syllables.map((s) => s.letters).join('')));
    for (const word of new Set(glossesOf(entry).flatMap(wordsOf))) {
      if (!glossWords.has(word)) glossWords.set(word, []);
      glossWords.get(word)!.push(i);
    }

    const key = fold(syllables.map((s) => s.letters[0]).join(''));
    if (key.length < 2) return;
    if (!initials.has(key)) initials.set(key, []);
    initials.get(key)!.push(i);
  });
  return {
    entries,
    simp: sortedKeys(entries, (entry) => entry.simp),
    trad: sortedKeys(entries, (entry) => entry.trad),
    pinyin: sortedKeys(entries, (_, i) => pinyinKeys[i]),
    initials,
    glossWords,
  };
}

/** The best tier of each entry that matched. */
type Matches = Map<number, Tier>;

function add(matches: Matches, entry: number, tier: Tier) {
  const best = matches.get(entry);
  if (best === undefined || tier < best) matches.set(entry, tier);
}

/**
 * A hanzi query: the exact entries of the learner's character set, or of the
 * other set when it has none, then the entries that start with the query.
 */
function matchHanzi(index: SearchIndex, query: string, charSet: 'simp' | 'trad', matches: Matches) {
  const other = charSet === 'simp' ? 'trad' : 'simp';
  for (const form of [charSet, other] as const) {
    for (const entry of withPrefix(index[form], query)) {
      add(matches, entry, index.entries[entry][form] === query ? Tier.ExactHanzi : Tier.HanziPrefix);
    }
  }
}

/**
 * A pinyin query: the entries whose pinyin is the query, then those whose
 * pinyin starts with it, then, for a query with no tone, those whose initials
 * are the query. A match in the middle of the pinyin is out of scope.
 */
function matchPinyin(index: SearchIndex, query: PinyinQuery, matches: Matches) {
  const key = fold(query.letters);
  for (const entry of withPrefix(index.pinyin, key)) {
    const syllables = syllablesOf(index.entries[entry].pinyin);
    if (!agrees(syllables, query)) continue;
    const length = syllables.reduce((n, s) => n + s.letters.length, 0);
    add(matches, entry, length === key.length ? Tier.FullPinyin : Tier.PartialPinyin);
  }
  if (query.tones.length > 0) return;
  for (const entry of index.initials.get(key) ?? []) {
    if (agrees(syllablesOf(index.entries[entry].pinyin).map(firstLetter), query)) {
      add(matches, entry, Tier.Initials);
    }
  }
}

const firstLetter = (s: Syllable): Syllable => ({ letters: s.letters[0], tone: s.tone });

/**
 * An English query: the best gloss of each entry decides its tier. An entry
 * whose glosses are all cross-references ranks last.
 */
function matchEnglish(index: SearchIndex, query: string, matches: Matches) {
  const words = wordsOf(query);
  if (words.length === 0) return;
  for (const entry of index.glossWords.get(words[0]) ?? []) {
    const glosses = glossesOf(index.entries[entry]);
    let best: Tier | null = null;
    for (const gloss of glosses) {
      const tier = glossTier(wordsOf(gloss), words);
      if (tier !== null && (best === null || tier < best)) best = tier;
    }
    if (best === null) continue;
    const crossReference = glosses.every((gloss) => CROSS_REFERENCE.test(gloss.trim()));
    add(matches, entry, crossReference ? Tier.CrossReference : best);
  }
}

/**
 * Inside a tier, the HSK words come first in the order of their rank. The
 * other entries come next, shortest first, then in CC-CEDICT order.
 */
function compare(index: SearchIndex, matches: Matches, charSet: 'simp' | 'trad') {
  return (a: number, b: number) => {
    const tier = matches.get(a)! - matches.get(b)!;
    if (tier !== 0) return tier;
    const qa = index.entries[a].q;
    const qb = index.entries[b].q;
    if (qa !== undefined || qb !== undefined) {
      if (qa === undefined) return 1;
      if (qb === undefined) return -1;
      if (qa !== qb) return qa - qb;
    }
    const length = [...index.entries[a][charSet]].length - [...index.entries[b][charSet]].length;
    return length !== 0 ? length : a - b;
  };
}

export function searchDictionary(
  index: SearchIndex,
  rawQuery: string,
  charSet: 'simp' | 'trad',
): WordResult[] {
  const query = rawQuery.trim();
  if (!query) return [];
  const matches: Matches = new Map();
  if (HAN.test(query)) {
    matchHanzi(index, query, charSet, matches);
  } else {
    // A tone in the query makes it pinyin, so the English match does not run.
    const pinyin = readPinyin(query);
    if (pinyin) matchPinyin(index, pinyin, matches);
    if (!pinyin || pinyin.tones.length === 0) matchEnglish(index, query, matches);
  }

  return [...matches.keys()]
    .sort(compare(index, matches, charSet))
    .slice(0, SEARCH_LIMIT)
    .map((i) => {
      const { id, simp, trad, pinyin, meaning } = index.entries[i];
      return { id, simp, trad, pinyin, meaning };
    });
}
