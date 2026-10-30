import { Direction, Word } from '../types/models';
import { removePunctuation } from '../components/Test/Logic/TestLogic';
import { parseMeanings } from './meaningUtils';
import { dropNeutralTone } from './pinyinMarks';

/**
 * Alternative answers: answers that fit the question shown but belong to a word
 * other than the one the question asks. See issue #348 and the "Alternative
 * answer" section of CONTEXT.md.
 *
 * Two sources give them. The `dictionaryAlternatives` Cloud Function covers all
 * of CC-CEDICT, and the index here covers the learner's own words: an amended
 * meaning, a word made by hand, and a session that starts offline.
 */

/** The directions whose question more than one word can answer. */
export type AlternativeDirection = 'MC' | 'MP' | 'PM' | 'PC';

/**
 * `CM` takes none: the Hanzi Writer quiz draws the strokes of one target
 * character, so it cannot accept another one.
 */
export const takesAlternatives = (direction: Direction): direction is AlternativeDirection =>
  direction !== 'CM';

/** The category of a typed answer. */
export type AnswerCategory = 'pinyin' | 'meaning';

/**
 * An answer as the grade compares it: no case or punctuation, and for pinyin no
 * spaces or neutral tone numbers.
 */
export const normaliseAnswer = (text: string, category: AnswerCategory): string => {
  const clean = removePunctuation(text.trim());
  return category === 'pinyin' ? dropNeutralTone(clean.replace(/ /g, '')) : clean;
};

/** Whether the input is one of the answers. */
export const answerMatches = (
  input: string,
  answers: readonly string[],
  category: AnswerCategory,
): boolean => {
  const clean = normaliseAnswer(input, category);
  return answers.some((answer) => normaliseAnswer(answer, category) === clean);
};

/** The learner's words, indexed by the value each question shows. */
export interface AlternativeIndex {
  words: Word[];
  byGloss: Map<string, number[]>;
  byPinyin: Map<string, number[]>;
  byChars: Map<string, number[]>;
}

const add = (map: Map<string, number[]>, key: string, position: number): void => {
  const positions = map.get(key);
  if (!positions) map.set(key, [position]);
  else if (positions[positions.length - 1] !== position) positions.push(position);
};

/**
 * Index the whole collection, not only the due words: the word that fits a
 * question is seldom due the same day. The characters are those of the
 * session's character set, as the question shows them.
 */
export function buildAlternativeIndex(words: Word[], charSet: 'simp' | 'trad'): AlternativeIndex {
  const index: AlternativeIndex = {
    words,
    byGloss: new Map(),
    byPinyin: new Map(),
    byChars: new Map(),
  };
  words.forEach((word, position) => {
    for (const gloss of parseMeanings(word.meaning)) {
      add(index.byGloss, normaliseAnswer(gloss, 'meaning'), position);
    }
    add(index.byPinyin, normaliseAnswer(word.pinyin, 'pinyin'), position);
    add(index.byChars, word[charSet], position);
  });
  return index;
}

/**
 * The answers of each of the learner's words that fit the question, in
 * collection order and with no repeats. The list holds the asked word's own
 * answer too; the engine matches the asked word first.
 */
export function ownWordAlternatives(
  index: AlternativeIndex,
  direction: Direction,
  question: string | string[],
): string[] {
  if (!takesAlternatives(direction)) return [];
  const values = Array.isArray(question) ? question : [question];

  let positions: number[];
  if (direction === 'PM') {
    positions = values.flatMap(
      (gloss) => index.byGloss.get(normaliseAnswer(gloss, 'meaning')) ?? [],
    );
  } else if (direction === 'MP') {
    positions = values.flatMap(
      (pinyin) => index.byPinyin.get(normaliseAnswer(pinyin, 'pinyin')) ?? [],
    );
  } else {
    positions = values.flatMap((chars) => index.byChars.get(chars) ?? []);
  }

  const answersPinyin = direction === 'PM' || direction === 'PC';
  const answers = Array.from(new Set(positions))
    .sort((a, b) => a - b)
    .flatMap((position) => {
      const word = index.words[position];
      return answersPinyin ? [word.pinyin] : parseMeanings(word.meaning);
    });
  return Array.from(new Set(answers));
}

/**
 * The name of a question in the alternatives the Cloud Function returned. It
 * is the value shown and not the word, because two words can show one value,
 * and a word can show another value after the learner amends its meaning.
 */
export const questionKey = (direction: Direction, question: string | string[]): string =>
  `${direction}:${Array.isArray(question) ? question.join('/') : question}`;

/** The alternative answers of a session from the Cloud Function, by `questionKey`. */
export type RemoteAlternatives = Record<string, string[]>;
