/**
 * The queue of the Comprehend and Compose tabs (#489): which words a tab may
 * use, in what order, and with which sentence. Pure: the words, the
 * `sentencePractice` documents and the sentence index come in as arguments.
 *
 * A sentence grade never changes the schedule of a word. It only orders the
 * queue of its tab. See docs/adr/0021-sentence-tasks-are-a-separate-practice.md.
 */
import { DIRECTIONS, Direction, Word } from '../types/models';
import { readyForComprehend, readyForCompose } from './directions';
import { parseDueDate } from './dueDate';
import { SentenceTab } from './sentenceSettings';

export type SentenceResult = 'right' | 'wrong';

/** The practice of one word in one tab. The dates are ISO strings. */
export interface TabPractice {
  lastPractised: string;
  lastResult: SentenceResult;
  /**
   * When the learner last saw each sentence of the word, by sentence id. The
   * queue reads only whether the other tab showed the sentence today (#581).
   */
  seen: Record<string, string>;
  /**
   * The lapse count of each trigger direction of the tab at the grade. A right
   * word comes back only when one of these counts goes up. A document written
   * before this field reads as 0 for each direction.
   */
  lapses?: Partial<Record<Direction, number>>;
}

export type WordPractice = Partial<Record<SentenceTab, TabPractice>>;

/** The `sentencePractice` documents, by word id. */
export type PracticeByWord = Record<string, WordPractice>;

/**
 * The sentence id of each tab for each word, by its simplified text: the
 * sentence of the pool of the tab, after borrowing (#581). A word with no
 * sentence has no entry.
 */
export type SentenceIndex = Record<string, Record<SentenceTab, string>>;

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

/**
 * The directions whose lapse brings a right word back to a tab. Comprehend
 * reads the meaning from the Chinese, so its trigger is a lapse of a direction
 * that answers with the meaning. Compose writes the Chinese from the meaning,
 * so its trigger is a lapse of a direction that asks for the Chinese.
 */
export const TRIGGER_DIRECTIONS: Record<SentenceTab, readonly Direction[]> = {
  comprehend: ['MC', 'MP'],
  compose: ['PM', 'CM'],
};

const lapsesOf = (word: Word, direction: Direction): number =>
  word.directions?.[direction]?.lapses ?? 0;

/** The lapse count of each trigger direction of the tab, for the snapshot of a grade. */
export function lapseSnapshot(word: Word, tab: SentenceTab): Partial<Record<Direction, number>> {
  return Object.fromEntries(
    TRIGGER_DIRECTIONS[tab].map((direction) => [direction, lapsesOf(word, direction)]),
  );
}

/** Whether a trigger direction of the tab lapsed after the grade of the entry. */
function lapsedSince(word: Word, entry: TabPractice, tab: SentenceTab): boolean {
  return TRIGGER_DIRECTIONS[tab].some(
    (direction) => lapsesOf(word, direction) > (entry.lapses?.[direction] ?? 0),
  );
}

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
 * Whether the two tabs share the sentence of the word and the other tab showed
 * it today, the local calendar day. Only a word that borrows can share a
 * sentence (#581). The word waits, because the learner would recall the
 * sentence, not the words (#496). It is eligible again on the next day.
 */
function sharedAndShownToday(
  practice: PracticeByWord,
  word: Word,
  sentences: Record<SentenceTab, string>,
  tab: SentenceTab,
  now: Date,
): boolean {
  const other = OTHER_TAB[tab];
  if (sentences[tab] !== sentences[other]) return false;
  const seen = practiceOf(practice, word, other)?.seen[sentences[tab]];
  return seen !== undefined && new Date(seen) >= startOfLocalDay(now);
}

/**
 * Whether a right grade keeps the word out of the tab: no trigger direction of
 * the tab lapsed after it. The learner knows the sentence, so it comes back
 * only when the word itself slips.
 */
function retired(practice: PracticeByWord, word: Word, tab: SentenceTab): boolean {
  const entry = practiceOf(practice, word, tab);
  return entry?.lastResult === 'right' && !lapsedSince(word, entry, tab);
}

const eligibleWords = ({ words, practice, index, tab, now }: QueueInput): Word[] =>
  gatedWords(words, tab, now).filter((word) => {
    const sentences = index[word.simp];
    return (
      sentences !== undefined &&
      !retired(practice, word, tab) &&
      !sharedAndShownToday(practice, word, sentences, tab, now)
    );
  });

/**
 * The tasks of one set, in order.
 *
 * The order is a rule to tune, in three groups:
 * 1. No practice in this tab, the lowest level first: the words the learner
 *    learns now, before the ones they already know well. A new sentence always
 *    comes before a miss.
 * 2. A wrong last grade, the oldest practice first. A miss comes back only
 *    when the tab has no new sentence left.
 * 3. A right last grade whose word lapsed since, the oldest practice first. A
 *    right word with no lapse since its grade never comes back.
 *
 * Each task shows the sentence of the pool of its tab (#581).
 */
export function buildSet(input: QueueInput & { size: number }): SentenceTask[] {
  const { practice, index, tab, size } = input;

  const group = (word: Word): number => {
    const entry = practiceOf(practice, word, tab);
    if (!entry) return 0;
    return entry.lastResult === 'wrong' ? 1 : 2;
  };
  const lastPractised = (word: Word): string =>
    practiceOf(practice, word, tab)?.lastPractised ?? '';

  const ordered = eligibleWords(input)
    .map((word, position) => ({ word, position }))
    .sort((a, b) => {
      const byGroup = group(a.word) - group(b.word);
      if (byGroup !== 0) return byGroup;
      if (group(a.word) === 0) {
        const byLevel = (a.word.level ?? 1) - (b.word.level ?? 1);
        if (byLevel !== 0) return byLevel;
      } else {
        const byDate = lastPractised(a.word).localeCompare(lastPractised(b.word));
        if (byDate !== 0) return byDate;
      }
      return a.position - b.position;
    });

  return ordered
    .slice(0, Math.max(0, size))
    .map(({ word }) => ({ word, sentenceId: index[word.simp][tab] }));
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
    lapses: Partial<Record<Direction, number>>;
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
        lapses: grade.lapses,
      },
    },
  };
}
