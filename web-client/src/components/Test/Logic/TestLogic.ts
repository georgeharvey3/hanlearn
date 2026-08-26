import { DIRECTIONS, Direction, Word, TestPerm, QuestionCategory } from '../../../types/models';
import { parseMeanings } from '../../../utils/meaningUtils';
import { isNewWord } from '../../../utils/directions';

const pickRandom = <T>(array: T[], n: number): T[] => {
  const remaining = [...array];
  const selected: T[] = [];
  const count = Math.min(n, remaining.length);
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
};

/**
 * Parse a due-date string into a Date.
 *
 * Three formats are in circulation:
 *   • YYYY/MM/DD  — stored by wordService.formatDate (the common case)
 *   • YYYY-MM-DD  — ISO date-only (hyphenated variant)
 *   • ISO 8601    — full timestamp like "2026-03-07T10:00:00.000Z" (demo words)
 *
 * ISO strings containing 'T' are parsed with new Date() — all browsers handle
 * these correctly.  Date-only strings are parsed manually so Safari/WebKit
 * (which returns Invalid Date for slash-separated strings) works on iOS.
 */
function parseDueDate(dateStr: string): Date | null {
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const normalised = dateStr.replace(/\//g, '-');
  const [year, month, day] = normalised.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function seedFromDate(date: Date): number {
  const str = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dueDateDay(dateStr: string): number {
  const d = parseDueDate(dateStr)!;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whether a word is due at all, by its derived due date. */
export const isDue = (word: Word, now: Date = new Date()): boolean => {
  if (!word.due_date) return false;
  const due = parseDueDate(word.due_date);
  return due !== null && due <= now;
};

export const chooseTestSet = (allWords: Word[], numWords: number): Word[] => {
  const today = new Date();
  const dueWords = allWords.filter((word) => {
    if (!word.due_date) return false;
    const due = parseDueDate(word.due_date);
    return due !== null && due <= today;
  });

  if (dueWords.length <= numWords) {
    return dueWords;
  }

  // Sort by due date ascending (oldest due first)
  dueWords.sort((a, b) => dueDateDay(a.due_date!) - dueDateDay(b.due_date!));

  // Find the cutoff date (the due date of the last word we'd take)
  const cutoffTime = dueDateDay(dueWords[numWords - 1].due_date!);

  const definitelyIn: Word[] = [];
  const tieGroup: Word[] = [];

  for (const word of dueWords) {
    const dayTime = dueDateDay(word.due_date!);
    if (dayTime < cutoffTime) {
      definitelyIn.push(word);
    } else if (dayTime === cutoffTime) {
      tieGroup.push(word);
    }
  }

  const remaining = numWords - definitelyIn.length;
  const seed = seedFromDate(today);
  const shuffledTies = seededShuffle(tieGroup, seed);

  return [...definitelyIn, ...shuffledTies.slice(0, remaining)];
};

const ranChoice = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

/** At most this many new words enter one session (rule 5 of the plan on #328). */
export const NEW_WORDS_PER_SESSION = 5;

export interface PlanSessionOptions {
  /** How many questions the session may ask. */
  budget: number;
  includeHandwriting: boolean;
  /** A direction to prefer over the fixed order, or 'none'. */
  priority?: string;
  /** Ask only the priority direction, and do not fan a new word out. */
  onlyPriority?: boolean;
  /** Practice ignores due dates and reschedules nothing. */
  practiceMode?: boolean;
  now?: Date;
}

export interface SessionPlan {
  /** The words the queue refers to. A queue entry's index points into this. */
  words: Word[];
  /** The (word, direction) pairs to ask, in the order to ask them. */
  queue: TestPerm[];
  /** The new words the session admits, which the new-word stage teaches first. */
  newWords: Word[];
}

/** A perm for one word (by its index in the plan) in one direction. */
function permFor(index: number, direction: Direction): TestPerm {
  return {
    index: index.toString(),
    aCategory: direction[0] as QuestionCategory,
    qCategory: direction[1] as QuestionCategory,
  };
}

/** The due date of one direction, falling back to the word's derived due date. */
function directionDueDate(word: Word, direction: Direction): string | undefined {
  return word.directions?.[direction]?.dueDate ?? word.due_date;
}

function isDirectionDue(word: Word, direction: Direction, today: Date): boolean {
  const dueDate = directionDueDate(word, direction);
  if (!dueDate) return false;
  const due = parseDueDate(dueDate);
  return due !== null && due <= today;
}

/**
 * The direction to ask a word in, from the ones available for it.
 *
 * Outside practice the fixed order of DIRECTIONS decides, so a word rotates:
 * the direction that passes takes a later due date, and the next session
 * reaches the next one down the list. `priority` displaces that order when the
 * preferred direction is among those available.
 *
 * Practice reschedules nothing, so that rotation would never advance and every
 * word would be asked in the same direction forever. It picks at random
 * instead, which is what practice did before the queue existed.
 */
function chooseDirection(
  available: Direction[],
  priority: string,
  practiceMode: boolean,
): Direction {
  if (practiceMode) return ranChoice(available);
  if (priority !== 'none' && available.includes(priority as Direction)) {
    return priority as Direction;
  }
  return DIRECTIONS.filter((direction) => available.includes(direction))[0];
}

/** The directions a session may ask at all, before any word is considered. */
function eligibleDirections(options: PlanSessionOptions): Direction[] {
  const { includeHandwriting, priority = 'none', onlyPriority = false } = options;
  if (onlyPriority && priority !== 'none') {
    return DIRECTIONS.filter((direction) => direction === priority);
  }
  return DIRECTIONS.filter((direction) => includeHandwriting || direction !== 'CM');
}

/**
 * Plan a session as a queue of (word, direction) pairs.
 *
 * A word appears at most once, which is what closes issue #306: two questions
 * about one word in the same session give each other away, because a word
 * holds three facts and every direction exposes two of them.
 *
 * A new word is the exception. It fans out to every direction the session asks,
 * because the new-word stage has just shown its character, pinyin and meaning
 * together, so there is nothing left for the fan-out to leak. At most
 * NEW_WORDS_PER_SESSION of them enter, after the review pairs, and only while
 * the budget still has room for a whole fan-out.
 *
 * See docs/adr/0002-direction-level-scheduling.md and the plan on issue #328.
 */
export const planSession = (candidates: Word[], options: PlanSessionOptions): SessionPlan => {
  const { budget, priority = 'none', onlyPriority = false, practiceMode = false } = options;
  const today = options.now ?? new Date();

  const eligible = eligibleDirections(options);
  if (budget <= 0 || eligible.length === 0) {
    return { words: [], queue: [], newWords: [] };
  }

  const newCandidates = candidates.filter(isNewWord);
  const reviewCandidates = candidates.filter((word) => !isNewWord(word));

  // ─── Review pairs: one direction per word, oldest due date first ──────────
  const reviewPairs: { word: Word; direction: Direction; dueDay: number }[] = [];

  for (const word of reviewCandidates) {
    const available = eligible.filter(
      (direction) => practiceMode || isDirectionDue(word, direction, today),
    );
    if (available.length === 0) continue;

    const direction = chooseDirection(available, priority, practiceMode);
    const dueDate = directionDueDate(word, direction);
    reviewPairs.push({
      word,
      direction,
      dueDay: dueDate ? dueDateDay(dueDate) : Number.POSITIVE_INFINITY,
    });
  }

  // Words that came due on the same day are interchangeable, so shuffle within
  // each day rather than letting the list order decide who is cut at the
  // budget. The seed is the day, so one day's session is stable if it reloads.
  const seed = seedFromDate(today);
  const byDay = new Map<number, typeof reviewPairs>();
  for (const pair of reviewPairs) {
    const group = byDay.get(pair.dueDay);
    if (group) group.push(pair);
    else byDay.set(pair.dueDay, [pair]);
  }
  const orderedReview = Array.from(byDay.keys())
    .sort((a, b) => a - b)
    .flatMap((day) => seededShuffle(byDay.get(day)!, seed))
    .slice(0, budget);

  // ─── New words: a whole fan-out each, while the budget holds one ──────────
  const questionsPerNewWord = onlyPriority && priority !== 'none' ? 1 : eligible.length;
  const admittedNew: Word[] = [];
  let remaining = budget - orderedReview.length;

  for (const word of newCandidates) {
    if (admittedNew.length >= NEW_WORDS_PER_SESSION) break;
    if (remaining < questionsPerNewWord) break;
    admittedNew.push(word);
    remaining -= questionsPerNewWord;
  }

  // ─── Assemble ────────────────────────────────────────────────────────────
  const words: Word[] = [...orderedReview.map((pair) => pair.word), ...admittedNew];
  const queue: TestPerm[] = orderedReview.map((pair, index) => permFor(index, pair.direction));

  admittedNew.forEach((_, newIndex) => {
    const index = orderedReview.length + newIndex;
    for (const direction of eligible) {
      queue.push(permFor(index, direction));
    }
  });

  return { words, queue, newWords: admittedNew };
};

/** The direction a perm asks, as the answer-first pair that names it. */
export const directionOf = (perm: TestPerm): Direction =>
  `${perm.aCategory}${perm.qCategory}` as Direction;

/**
 * The distinct directions a perm list asks, in the order the list holds them.
 * finishTest reschedules only these, so the directions the session left out
 * keep the bank and due date they already hold.
 */
export const directionsOf = (permList: TestPerm[]): Direction[] => {
  const seen = new Set<string>();
  const directions: Direction[] = [];
  for (const perm of permList) {
    const direction = directionOf(perm);
    if (seen.has(direction)) continue;
    seen.add(direction);
    directions.push(direction);
  }
  return directions;
};

function resolveCategory(
  category: QuestionCategory,
  word: Word,
  charSet: 'simp' | 'trad',
): { value: string | string[]; label: string } {
  if (category === 'C') return { value: word[charSet], label: 'character' };
  if (category === 'P') return { value: word.pinyin, label: 'pinyin' };
  return { value: parseMeanings(word.meaning), label: 'meaning' };
}

export interface AssignQAResult {
  perm: TestPerm;
  chosenCharacter: string;
  answer: string | string[];
  answerCategory: string;
  question: string | string[];
  questionCategory: string;
}

/**
 * Read the next pair from the planned queue.
 *
 * planSession has already decided the order, so this takes the head of the
 * queue rather than choosing: the priority direction and the due-date order
 * were applied at planning time.
 */
export const assignQA = (
  testSet: Word[],
  queue: TestPerm[],
  charSet: 'simp' | 'trad',
): AssignQAResult => {
  const perm = queue[0];
  const word = testSet[parseInt(perm.index)];

  const { value: Ax, label: ACs } = resolveCategory(perm.aCategory, word, charSet);
  const { value: Qx, label: QCs } = resolveCategory(perm.qCategory, word, charSet);

  return {
    perm,
    chosenCharacter: word[charSet],
    answer: Ax,
    answerCategory: ACs,
    question: Qx,
    questionCategory: QCs,
  };
};

export const toneChecker = (inp: string, answer: string): boolean => {
  return inp.replace(/[0-9]/g, '') === answer.replace(/[0-9]/g, '');
};

export const Counter = (array: string[]): Record<string, number> => {
  const count: Record<string, number> = {};
  array.forEach((val) => (count[val] = (count[val] || 0) + 1));
  return count;
};

export const removePunctuation = (word: string): string => {
  return word
    .toLowerCase()
    .replace(/[.,/#!'$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s{2,}/g, ' ');
};
