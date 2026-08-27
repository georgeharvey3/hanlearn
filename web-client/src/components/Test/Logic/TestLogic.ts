import { DIRECTIONS, Direction, Word, TestPerm, QuestionCategory } from '../../../types/models';
import { parseMeanings } from '../../../utils/meaningUtils';
import { isNewWord } from '../../../utils/directions';

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

/**
 * The session options that the learner's settings decide.
 *
 * `TestWords` plans the session and the engine reads that plan, so both need
 * the same options. Reading them here rather than in each caller keeps one
 * answer to "how long is a session, and which directions does it ask".
 */
export const readSessionSettings = (isDemo = false): Omit<PlanSessionOptions, 'practiceMode'> => {
  const numWords = parseInt(localStorage.getItem('numWords') || '5');
  return {
    // Five questions per word keeps a session the length it was before the
    // queue existed. PR 5 replaces this with the `questionsPerSession` setting.
    budget: numWords * 5,
    includeHandwriting: localStorage.getItem('useHandwriting') !== 'false' || isDemo,
    priority: isDemo ? 'none' : localStorage.getItem('priority') || 'none',
    onlyPriority: isDemo ? false : localStorage.getItem('onlyPriority') === 'true',
  };
};

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
 * A seed for one word's tie-break, distinct from every other word's.
 *
 * The day seed alone is not enough. seededShuffle is a plain LCG, so the same
 * seed and the same tied set give the same permutation, and every word whose
 * five directions are still in step would take the same direction all day.
 * That is the fault this replaces, one step to the side.
 *
 * `id` is parseInt of the Firestore document id, so it is NaN for a document
 * whose id is not numeric. The characters carry the seed in that case.
 */
function wordSeed(word: Word, daySeed: number): number {
  let hash = daySeed;
  const text = word.simp || word.trad || '';
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return (hash ^ (Number.isFinite(word.id) ? word.id : 0)) | 0;
}

/** The due day of one direction, or +Infinity when it has no due date at all. */
function directionDueDay(word: Word, direction: Direction): number {
  const dueDate = directionDueDate(word, direction);
  if (!dueDate) return Number.POSITIVE_INFINITY;
  const due = parseDueDate(dueDate);
  return due === null
    ? Number.POSITIVE_INFINITY
    : new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
}

/**
 * The direction to ask a word in, from the ones available for it.
 *
 * The direction that has waited longest wins: the available directions are
 * ranked by their own due dates, oldest first. A direction that falls behind
 * therefore cannot be starved by one that is already ahead.
 *
 * Directions that share the oldest due date are interchangeable, and the
 * schedule has no opinion between them. `priority` decides there if the learner
 * set one. Otherwise the choice is random, seeded per word so that a reload on
 * the same day asks the same question while different words differ.
 *
 * The fixed order of DIRECTIONS used to decide this outright, which asked `MC`
 * of every word until it passed, because a word whose directions are still in
 * step has all five tied. See docs/adr/0003-direction-choice-by-oldest-due.md.
 *
 * Practice reschedules nothing, so every direction stays tied forever and the
 * seeded choice would repeat for the rest of the day. It picks at random on
 * every call instead, which is what practice did before the queue existed.
 */
function chooseDirection(
  word: Word,
  available: Direction[],
  priority: string,
  practiceMode: boolean,
  daySeed: number,
): Direction {
  if (practiceMode) return ranChoice(available);

  const oldest = Math.min(...available.map((direction) => directionDueDay(word, direction)));
  const tied = available.filter((direction) => directionDueDay(word, direction) === oldest);

  if (priority !== 'none' && tied.includes(priority as Direction)) {
    return priority as Direction;
  }
  return seededShuffle(tied, wordSeed(word, daySeed))[0];
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
 * A new word is no exception. It takes one direction like any other word, and
 * the four it leaves stay at level 1 and due, so later sessions reach them
 * through the same ranking. At most NEW_WORDS_PER_SESSION of them enter, after
 * the review pairs. See docs/adr/0005-new-words-take-one-direction.md.
 *
 * See docs/adr/0002-direction-level-scheduling.md and the plan on issue #328.
 */
export const planSession = (candidates: Word[], options: PlanSessionOptions): SessionPlan => {
  const { budget, priority = 'none', practiceMode = false } = options;
  const today = options.now ?? new Date();

  const eligible = eligibleDirections(options);
  if (budget <= 0 || eligible.length === 0) {
    return { words: [], queue: [], newWords: [] };
  }

  const newCandidates = candidates.filter(isNewWord);
  const reviewCandidates = candidates.filter((word) => !isNewWord(word));

  // One seed for the day, so a reload rebuilds the same session. Every use
  // below mixes something of its own into it: the word for a direction
  // tie-break, the entry itself for the two shuffles over distinct lists.
  const seed = seedFromDate(today);

  // ─── Review pairs: one direction per word, oldest due date first ──────────
  const reviewPairs: { word: Word; direction: Direction; dueDay: number }[] = [];

  for (const word of reviewCandidates) {
    const available = eligible.filter(
      (direction) => practiceMode || isDirectionDue(word, direction, today),
    );
    if (available.length === 0) continue;

    const direction = chooseDirection(word, available, priority, practiceMode, seed);
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

  // ─── New words: one direction each, after the reviews ────────────────────
  // A new word costs one question, the same as a review word. All five of its
  // directions are at level 1 and share one due date, so they are all tied and
  // chooseDirection settles it the same way it settles any other tie.
  const newPairs: { word: Word; direction: Direction }[] = [];
  let remaining = budget - orderedReview.length;

  for (const word of newCandidates) {
    if (newPairs.length >= NEW_WORDS_PER_SESSION) break;
    if (remaining < 1) break;

    // A new word is due in every direction, so this filter normally keeps them
    // all. It stays for a word added with a due date in the future.
    const due = eligible.filter(
      (direction) => practiceMode || isDirectionDue(word, direction, today),
    );
    const available = due.length > 0 ? due : eligible;

    newPairs.push({
      word,
      direction: chooseDirection(word, available, priority, practiceMode, seed),
    });
    remaining -= 1;
  }

  // ─── Assemble ────────────────────────────────────────────────────────────
  const pairs = [...orderedReview, ...newPairs];
  const words: Word[] = pairs.map((pair) => pair.word);
  const queue: TestPerm[] = pairs.map((pair, index) => permFor(index, pair.direction));

  return { words, queue, newWords: newPairs.map((pair) => pair.word) };
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
