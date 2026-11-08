/**
 * The queue of the Comprehend and Compose tabs (#489): which words a tab may
 * use, in what order, and with which sentence. Pure: the words, the
 * `sentencePractice` documents and the sentence index come in as arguments.
 *
 * A sentence grade never changes the schedule of a word. It only orders the
 * queue of its tab. See docs/adr/0021-sentence-tasks-are-a-separate-practice.md.
 */
import { DIRECTIONS, Word } from '../types/models';
import { readyForComprehend, readyForCompose } from './directions';
import { parseDueDate } from './dueDate';
import { SentenceTab } from './sentenceSettings';

export type SentenceResult = 'right' | 'wrong';

/** The practice of one word in one tab. The dates are ISO strings. */
export interface TabPractice {
  lastPractised: string;
  lastResult: SentenceResult;
  /** When the learner last saw each sentence of the word, by sentence id. */
  seen: Record<string, string>;
}

export type WordPractice = Partial<Record<SentenceTab, TabPractice>>;

/** The `sentencePractice` documents, by word id. */
export type PracticeByWord = Record<string, WordPractice>;

/** The ids of the example sentences of each word, by its simplified text, in file order. */
export type SentenceIndex = Record<string, string[]>;

/** One task of a set: a word and the sentence to show with it. */
export interface SentenceTask {
  word: Word;
  sentenceId: string;
}

/**
 * The number of days, today included, in which a due direction keeps a word
 * out of the tabs. A sentence primes the answer of a card review, so a word
 * that a review asks today or tomorrow is not shown. A `fail` from today is due
 * tomorrow, so this rule also keeps today's misses out, with no rule of its own.
 */
export const REVIEW_CLEARANCE_DAYS = 2;

const GATES: Record<SentenceTab, (word: Word) => boolean> = {
  comprehend: readyForComprehend,
  compose: readyForCompose,
};

/** Local midnight at the start of the day `days` days after `now`. */
const startOfLocalDay = (now: Date, days = 0): Date =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);

/** Whether no direction of the word is due before the clearance ends. */
function clearOfReviews(word: Word, now: Date): boolean {
  const clear = startOfLocalDay(now, REVIEW_CLEARANCE_DAYS);
  const dueDates = word.directions
    ? DIRECTIONS.map((direction) => word.directions![direction].dueDate)
    : [word.due_date];
  return dueDates.every((dueDate) => {
    const due = dueDate ? parseDueDate(dueDate) : null;
    return due !== null && due >= clear;
  });
}

/**
 * The words that pass the gate of the tab and have no direction due within the
 * clearance. The caller loads the sentence index for these words only.
 */
export function gatedWords(words: Word[], tab: SentenceTab, now: Date): Word[] {
  return words.filter((word) => GATES[tab](word) && clearOfReviews(word, now));
}

interface QueueInput {
  words: Word[];
  practice: PracticeByWord;
  index: SentenceIndex;
  tab: SentenceTab;
  now: Date;
}

const practiceOf = (practice: PracticeByWord, word: Word, tab: SentenceTab) =>
  practice[String(word.id)]?.[tab];

const OTHER_TAB: Record<SentenceTab, SentenceTab> = {
  comprehend: 'compose',
  compose: 'comprehend',
};

/**
 * Whether the other tab showed every sentence of the word today, the local
 * calendar day. The word then waits until tomorrow: the learner would recall
 * the sentence, not the words (#496). Only the other tab counts, and only the
 * sentences of the index.
 */
function shownInOtherTabToday(
  practice: PracticeByWord,
  word: Word,
  sentenceIds: string[],
  tab: SentenceTab,
  now: Date,
): boolean {
  const seen = practiceOf(practice, word, OTHER_TAB[tab])?.seen ?? {};
  const today = startOfLocalDay(now);
  return sentenceIds.every((id) => seen[id] !== undefined && new Date(seen[id]) >= today);
}

const eligibleWords = ({ words, practice, index, tab, now }: QueueInput): Word[] =>
  gatedWords(words, tab, now).filter((word) => {
    const sentenceIds = index[word.simp] ?? [];
    return sentenceIds.length > 0 && !shownInOtherTabToday(practice, word, sentenceIds, tab, now);
  });

/**
 * The later of the two dates at which the tabs last showed the sentence, or ''
 * if neither tab showed it. A sentence that one tab showed primes the other tab
 * as much as its own (#496).
 */
function lastViewInEitherTab(practice: PracticeByWord, word: Word, sentenceId: string): string {
  const comprehend = practiceOf(practice, word, 'comprehend')?.seen[sentenceId] ?? '';
  const compose = practiceOf(practice, word, 'compose')?.seen[sentenceId] ?? '';
  return comprehend > compose ? comprehend : compose;
}

/**
 * The tasks of one set, in order.
 *
 * The order is a rule to tune, in three groups:
 * 1. A wrong last grade, the oldest practice first. Misses come back soonest,
 *    and a big import of new words does not push them back.
 * 2. No practice in this tab, the lowest level first: the words the learner
 *    learns now, before the ones they already know well.
 * 3. A right last grade, the oldest practice first, so good words rotate.
 *
 * Inside a word, the sentence seen longest ago in either tab comes first, and
 * a sentence never seen counts as the oldest.
 */
export function buildSet(input: QueueInput & { size: number }): SentenceTask[] {
  const { practice, index, tab, size } = input;

  const group = (word: Word): number => {
    const entry = practiceOf(practice, word, tab);
    if (!entry) return 1;
    return entry.lastResult === 'wrong' ? 0 : 2;
  };
  const lastPractised = (word: Word): string =>
    practiceOf(practice, word, tab)?.lastPractised ?? '';

  const ordered = eligibleWords(input)
    .map((word, position) => ({ word, position }))
    .sort((a, b) => {
      const byGroup = group(a.word) - group(b.word);
      if (byGroup !== 0) return byGroup;
      if (group(a.word) === 1) {
        const byLevel = (a.word.level ?? 1) - (b.word.level ?? 1);
        if (byLevel !== 0) return byLevel;
      } else {
        const byDate = lastPractised(a.word).localeCompare(lastPractised(b.word));
        if (byDate !== 0) return byDate;
      }
      return a.position - b.position;
    });

  return ordered.slice(0, Math.max(0, size)).map(({ word }) => {
    const sentenceIds = index[word.simp];
    const lastView = (sentenceId: string) => lastViewInEitherTab(practice, word, sentenceId);
    // A never-seen sentence sorts as '', before every date. The sort is stable,
    // so a tie keeps the order of the file.
    const [sentenceId] = [...sentenceIds].sort((a, b) => lastView(a).localeCompare(lastView(b)));
    return { word, sentenceId };
  });
}

/** Whether the tab holds an eligible word that the learner never practised there. */
export function hasNeverPractised(input: QueueInput): boolean {
  return eligibleWords(input).some((word) => !practiceOf(input.practice, word, input.tab));
}

/** The practice after one grade, for the next set of the same visit. */
export function recordPractice(
  practice: PracticeByWord,
  grade: {
    wordId: number;
    tab: SentenceTab;
    sentenceId: string;
    result: SentenceResult;
    at: Date;
  },
): PracticeByWord {
  const key = String(grade.wordId);
  const when = grade.at.toISOString();
  const before = practice[key]?.[grade.tab];
  return {
    ...practice,
    [key]: {
      ...practice[key],
      [grade.tab]: {
        lastPractised: when,
        lastResult: grade.result,
        seen: { ...before?.seen, [grade.sentenceId]: when },
      },
    },
  };
}
