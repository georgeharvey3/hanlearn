/**
 * The rules of the word bank on /add-words: which words it covers, and which
 * words a search finds.
 */
import { Word } from '../types/models';
import { isNewWord } from './directions';

/**
 * A word due within this many days shows no characters, pinyin or meaning on
 * the word bank until the learner taps it. Seeing a word just before the test
 * asks it primes the answer, and the scheduler then records a recall that was
 * not real. Two days covers today and tomorrow.
 */
const COVER_WITHIN_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today to the due date: 0 today, negative when overdue. */
function daysUntilDue(dueDate: string, today: Date = new Date()): number {
  const [y, m, d] = dueDate.replace(/\//g, '-').split('-').map(Number);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - midnight.getTime()) / DAY_MS);
}

/**
 * Whether the bank covers the word. A new word is exempt: the learner just
 * added it, and the introduction before its first test shows it anyway.
 */
export function isCovered(word: Word, today: Date = new Date()): boolean {
  if (!word.due_date || isNewWord(word)) return false;
  return daysUntilDue(word.due_date, today) < COVER_WITHIN_DAYS;
}

/** Lower case, with no tone marks and no spaces: "Tú shū" reads "tushu". */
const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s]/g, '')
    .toLowerCase();

/**
 * Whether a bank word matches the search text, by characters, pinyin or
 * meaning. A covered word matches by its characters only: a match on its
 * pinyin or meaning would tell the learner what it is.
 */
export function matchesBank(word: Word, query: string, today: Date = new Date()): boolean {
  const q = query.trim();
  if (!q) return false;
  if (word.simp.includes(q) || word.trad.includes(q)) return true;
  if (isCovered(word, today)) return false;
  const folded = fold(q);
  return (
    fold(word.pinyin).includes(folded) ||
    fold(word.ammended_meaning || word.meaning).includes(folded)
  );
}

/**
 * Whether the bank holds a dictionary entry. One set of characters can be
 * several entries (好 hǎo and 好 hào), so the pinyin must match too.
 */
export function findInBank(entry: Word, bank: Word[]): Word | undefined {
  return bank.find(
    (w) => w.id === entry.id || (w.simp === entry.simp && w.pinyin === entry.pinyin),
  );
}

export const isInBank = (entry: Word, bank: Word[]): boolean => !!findInBank(entry, bank);
