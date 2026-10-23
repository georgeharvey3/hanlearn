/**
 * The counting rules of the session's end: the summary's tiles and score, and
 * the next due count of the "nothing due" screen. Pure, so the screens only
 * draw what these return.
 */
import { Direction, DirectionResult, Word, WordScore } from '../../../types/models';
import { wordsDueAhead } from '../../../utils/dashboard';
import { parseDueDate } from '../../../utils/dueDate';
import { parseMeanings } from '../../../utils/meaningUtils';
import { toneMarks } from '../../../utils/pinyinMarks';

/** One answered question, with its word's pinyin and meaning for the tile's back. */
export interface SummaryRow {
  char: string;
  pinyin: string;
  meaning: string;
  direction: Direction;
  result: DirectionResult;
  /** The word the question came from; undefined if it is no longer in the list. */
  wordId?: number;
}

export interface Tally {
  total: number;
  /** Distinct words: one word can be asked in more than one direction. */
  words: number;
  pass: number;
  lapse: number;
  fail: number;
}

// The missed questions come first: they are the ones worth a second look.
const ORDER: Record<DirectionResult, number> = { fail: 0, lapse: 1, pass: 2 };

const findWord = (char: string, words: Word[]): Word | undefined =>
  words.find((w) => w.simp === char || w.trad === char);

/** The summary's rows: one per question, Not known first, then Nearly, then Known. */
export function summaryRows(scores: WordScore[], words: Word[]): SummaryRow[] {
  return scores
    .map((score) => {
      const word = findWord(score.char, words);
      const meaning = word?.ammended_meaning || word?.meaning || '';
      return {
        char: score.char,
        pinyin: word?.pinyin ? toneMarks(word.pinyin) : '',
        meaning: parseMeanings(meaning).join('; '),
        direction: score.direction,
        result: score.result,
        wordId: word?.id,
      };
    })
    .sort((a, b) => ORDER[a.result] - ORDER[b.result]);
}

/**
 * The counts per question, not per word. A lapse is not counted as known: it
 * did not succeed on the attempt that carries the grade. See
 * docs/adr/0007-grade-the-first-attempt.md.
 */
export function tally(rows: SummaryRow[]): Tally {
  return {
    total: rows.length,
    words: new Set(rows.map((r) => r.char)).size,
    pass: rows.filter((r) => r.result === 'pass').length,
    lapse: rows.filter((r) => r.result === 'lapse').length,
    fail: rows.filter((r) => r.result === 'fail').length,
  };
}

/** The words with a Nearly or Not known question, once each: what "Practise missed words" asks. */
export function missedWords(rows: SummaryRow[], words: Word[]): Word[] {
  const ids = new Set(rows.filter((r) => r.result !== 'pass').map((r) => r.wordId));
  return words.filter((w) => ids.has(w.id));
}

/** How many words fall due, and how many days ahead: 0 is later today. */
export interface NextDue {
  count: number;
  days: number;
}

// "Nothing due this week" past this many days.
const AHEAD_DAYS = 7;

/**
 * The first day ahead with words due, and how many: "8 due tomorrow". Day 0 is
 * later today, for a word due after now. Counts only, never the words: a word
 * seen here just before the test asks it primes the answer.
 */
export function nextDue(words: Word[], now: Date): NextDue | null {
  // isDue counts a word due by `now`, so what is left of today is not due yet.
  const upcoming = words.filter((w) => {
    const due = w.due_date ? parseDueDate(w.due_date) : null;
    return due !== null && due > now;
  });
  const counts = wordsDueAhead(upcoming, AHEAD_DAYS + 1, now);
  const days = counts.findIndex((n) => n > 0);
  return days < 0 ? null : { count: counts[days], days };
}
