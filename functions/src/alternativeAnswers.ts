/**
 * The alternative answers of a question: the answers of the other entries of
 * CC-CEDICT that fit the question shown. See issue #348 and the "Alternative
 * answer" section of CONTEXT.md.
 *
 * Pure: dictionary.ts loads the entries and builds the index once per
 * instance, and the callable asks it.
 */

import { DictionaryEntry } from './dictionarySearch';

/** The directions whose question more than one entry can answer. `CM` is out. */
export type AlternativeDirection = 'MC' | 'MP' | 'PM' | 'PC';

const ALTERNATIVE_DIRECTIONS: readonly AlternativeDirection[] = ['MC', 'MP', 'PM', 'PC'];

/**
 * The value that one question shows: the glosses of a meaning question, the
 * pinyin of a pinyin question, or the characters of a character question.
 */
export interface AlternativeQuestion {
  direction: AlternativeDirection;
  value: string | string[];
}

export interface AlternativeIndex {
  entries: DictionaryEntry[];
  byGloss: Map<string, number[]>;
  byPinyin: Map<string, number[]>;
  bySimp: Map<string, number[]>;
  byTrad: Map<string, number[]>;
}

/**
 * The rule of `removePunctuation` in the client's TestLogic.ts, which grades
 * the answers. The two must agree, or a gloss matches on one side only.
 */
const removePunctuation = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[.,/#!'$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s{2,}/g, ' ');

/** The rule of `dropNeutralTone` in the client's pinyinMarks.ts. */
const dropNeutralTone = (numbered: string): string => numbered.replace(/([a-zü:v])[05]/gi, '$1');

/** A gloss as the client compares it. */
const glossKey = (gloss: string): string => removePunctuation(gloss.trim());

/** A pinyin as the client compares it: no case, spaces or neutral tone numbers. */
const pinyinKey = (pinyin: string): string =>
  dropNeutralTone(removePunctuation(pinyin.trim()).replace(/ /g, ''));

/**
 * The glosses of a meaning, as the client's `parseMeanings` gives them: each
 * `/` or `;` part, trimmed, with no classifier note.
 */
const glossesOf = (meaning: string): string[] =>
  meaning
    .split(/[/;]/)
    .map((gloss) => gloss.trim())
    .filter((gloss) => gloss.length > 0 && !gloss.startsWith('CL:'));

const add = (map: Map<string, number[]>, key: string, position: number): void => {
  const positions = map.get(key);
  if (!positions) map.set(key, [position]);
  else if (positions[positions.length - 1] !== position) positions.push(position);
};

export function createAlternativeIndex(entries: DictionaryEntry[]): AlternativeIndex {
  const index: AlternativeIndex = {
    entries,
    byGloss: new Map(),
    byPinyin: new Map(),
    bySimp: new Map(),
    byTrad: new Map(),
  };
  entries.forEach((entry, position) => {
    for (const gloss of glossesOf(entry.meaning)) add(index.byGloss, glossKey(gloss), position);
    add(index.byPinyin, pinyinKey(entry.pinyin), position);
    add(index.bySimp, entry.simp, position);
    add(index.byTrad, entry.trad, position);
  });
  return index;
}

/**
 * The answers, in dictionary order and with no repeats, of each entry that fits
 * the question. A pinyin answer is the pinyin of an entry, and a meaning answer
 * is one gloss of it.
 *
 * The list holds the answer of the asked word too, when the word is an entry.
 * The client matches the asked word first, so that answer never counts as an
 * alternative.
 */
export function alternativeAnswers(
  index: AlternativeIndex,
  question: AlternativeQuestion,
  charSet: 'simp' | 'trad',
): string[] {
  const { direction, value } = question;
  const values = Array.isArray(value) ? value : [value];

  let positions: number[];
  if (direction === 'PM') {
    positions = values.flatMap((gloss) => index.byGloss.get(glossKey(gloss)) ?? []);
  } else if (direction === 'MP') {
    positions = values.flatMap((pinyin) => index.byPinyin.get(pinyinKey(pinyin)) ?? []);
  } else {
    const byChars = charSet === 'simp' ? index.bySimp : index.byTrad;
    positions = values.flatMap((chars) => byChars.get(chars) ?? []);
  }

  const answersPinyin = direction === 'PM' || direction === 'PC';
  const answers = [...new Set(positions)]
    .sort((a, b) => a - b)
    .flatMap((position) => {
      const entry = index.entries[position];
      return answersPinyin ? [entry.pinyin] : glossesOf(entry.meaning);
    });
  return [...new Set(answers)];
}

/** The questions of one session, with the character set they show. */
export interface AlternativesRequest {
  charSet: 'simp' | 'trad';
  questions: AlternativeQuestion[];
}

/**
 * The bounds of one request. A session asks at most 50 questions, and the
 * client sends each question value once, so these leave room and stop abuse.
 */
const MAX_QUESTIONS = 200;
const MAX_GLOSSES = 50;
const MAX_VALUE_LENGTH = 200;

const isShortString = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_VALUE_LENGTH;

function isQuestion(value: unknown): value is AlternativeQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const { direction, value: shown } = value as Record<string, unknown>;
  if (!ALTERNATIVE_DIRECTIONS.includes(direction as AlternativeDirection)) return false;
  // A meaning question shows a list of glosses, and the others one string.
  if (direction === 'PM') {
    return Array.isArray(shown) && shown.length <= MAX_GLOSSES && shown.every(isShortString);
  }
  return isShortString(shown);
}

/** The request of the callable, or null when it is not one this module can answer. */
export function readAlternativesRequest(data: unknown): AlternativesRequest | null {
  if (typeof data !== 'object' || data === null) return null;
  const { charSet, questions } = data as Record<string, unknown>;
  if (charSet !== 'simp' && charSet !== 'trad') return null;
  if (!Array.isArray(questions) || questions.length > MAX_QUESTIONS) return null;
  if (!questions.every(isQuestion)) return null;
  return { charSet, questions };
}
