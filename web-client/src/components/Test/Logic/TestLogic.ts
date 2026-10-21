import { DIRECTIONS, Direction, Word, QueuePair, QuestionCategory } from '../../../types/models';
import { parseMeanings } from '../../../utils/meaningUtils';
import { isNewWord } from '../../../utils/directions';
import { readQuestionsPerSession } from '../../../utils/sessionSettings';
import { parseDueDate } from '../../../utils/dueDate';

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

/**
 * The session options that the learner's settings decide.
 *
 * `TestWords` plans the session and the engine reads that plan, so both need
 * the same options. Reading them here rather than in each caller keeps one
 * answer to "how long is a session, and which directions does it ask".
 */
export const readSessionSettings = (isDemo = false): Omit<PlanSessionOptions, 'practiceMode'> => {
  return {
    budget: readQuestionsPerSession(),
    includeHandwriting: localStorage.getItem('useHandwriting') !== 'false' || isDemo,
    priority: isDemo ? 'none' : localStorage.getItem('priority') || 'none',
    onlyPriority: isDemo ? false : localStorage.getItem('onlyPriority') === 'true',
  };
};

/**
 * At most this many new words enter one session.
 *
 * The budget alone cannot hold the new-word load down. `addWordToList` gives a
 * new word a due date of today or tomorrow, so a learner who adds 30 words in
 * one sitting meets every one of them in the next session and reviews nothing.
 * A session that teaches more than five words at once is also more than a
 * learner takes in. See docs/adr/0015-a-cap-on-new-words-per-session.md.
 */
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
  queue: QueuePair[];
  /** The new words the session admits, which the new-word stage teaches first. */
  newWords: Word[];
}

/** The queue pair for one word, by its index in the plan, in one direction. */
function pairFor(index: number, direction: Direction): QueuePair {
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

/** The due day of one direction, or +Infinity when it has no due date at all. */
function directionDueDay(word: Word, direction: Direction): number {
  const dueDate = directionDueDate(word, direction);
  if (!dueDate) return Number.POSITIVE_INFINITY;
  const due = parseDueDate(dueDate);
  return due === null
    ? Number.POSITIVE_INFINITY
    : new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
}

/** The directions a session may ask at all, before any word is considered. */
export function eligibleDirections(
  options: Pick<PlanSessionOptions, 'includeHandwriting' | 'priority' | 'onlyPriority'>,
): Direction[] {
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
 * The plan ranks pairs, not words: every due (word, direction) pair, by the
 * due date of that direction, oldest first. Each direction may then fill only
 * its direction share of the budget, so a direction that fails often (`CM`)
 * cannot crowd the others out of the session. A word whose oldest direction
 * has no room goes to its oldest due direction that has room.
 * See docs/adr/0017-balance-the-directions-in-each-session.md.
 *
 * At most NEW_WORDS_PER_SESSION new words enter, and the due date decides which
 * ones: a sixth new word is passed over and the pair behind it takes the
 * question. See docs/adr/0015-a-cap-on-new-words-per-session.md.
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

  // ─── Every due pair of every word ────────────────────────────────────────
  type Pair = { word: Word; direction: Direction; dueDay: number };
  const pairs: Pair[] = [];
  for (const word of candidates) {
    for (const direction of eligible) {
      if (practiceMode || isDirectionDue(word, direction, today)) {
        pairs.push({ word, direction, dueDay: directionDueDay(word, direction) });
      }
    }
  }

  // ─── Rank by the due date of the direction, oldest first ─────────────────
  // Pairs that came due on the same day are interchangeable, so shuffle within
  // each day rather than letting the list order decide who is cut at the
  // budget. The seed is the day, so one day's session is stable if it reloads.
  // The priority direction breaks the tie: its pairs lead their day.
  //
  // Practice ignores the due date and reschedules nothing, so a seeded order
  // would repeat all day. It shuffles every pair afresh on each run.
  let ranked: Pair[];
  if (practiceMode) {
    ranked = seededShuffle(pairs, (Math.random() * 0x100000000) | 0);
  } else {
    const seed = seedFromDate(today);
    const byDay = new Map<number, Pair[]>();
    for (const pair of pairs) {
      const group = byDay.get(pair.dueDay);
      if (group) group.push(pair);
      else byDay.set(pair.dueDay, [pair]);
    }
    ranked = Array.from(byDay.keys())
      .sort((a, b) => a - b)
      .flatMap((day) => {
        const shuffled = seededShuffle(byDay.get(day)!, seed);
        return [
          ...shuffled.filter((pair) => pair.direction === priority),
          ...shuffled.filter((pair) => pair.direction !== priority),
        ];
      });
  }

  // ─── Take the budget in two walks ────────────────────────────────────────
  // The share walk holds each direction to its share. The fill walk then gives
  // the questions a short direction left free to whatever pairs remain, so a
  // share is a limit and never makes the session shorter.
  //
  // A new word passed over by the cap does not hold its question open: the
  // next pair in the ranking takes it, so the cap costs the session nothing
  // while any word is left to review.
  const share = Math.floor(budget / eligible.length);
  const taken = new Set<Pair>();
  const wordsTaken = new Set<Word>();
  const perDirection = new Map<Direction, number>();
  let newAdmitted = 0;

  const walk = (withShares: boolean) => {
    for (const pair of ranked) {
      if (taken.size === budget) return;
      if (wordsTaken.has(pair.word)) continue;
      const used = perDirection.get(pair.direction) ?? 0;
      if (withShares && used === share) continue;
      const isNew = isNewWord(pair.word);
      if (isNew && newAdmitted === NEW_WORDS_PER_SESSION) continue;

      if (isNew) newAdmitted++;
      taken.add(pair);
      wordsTaken.add(pair.word);
      perDirection.set(pair.direction, used + 1);
    }
  };
  walk(true);
  walk(false);

  // ─── Assemble, in the order of the ranking ───────────────────────────────
  const ordered = ranked.filter((pair) => taken.has(pair));
  const words: Word[] = ordered.map((pair) => pair.word);
  const queue: QueuePair[] = ordered.map((pair, index) => pairFor(index, pair.direction));

  return { words, queue, newWords: words.filter(isNewWord) };
};

/** The direction a queue pair asks, written answer-first. */
export const directionOf = (pair: QueuePair): Direction =>
  `${pair.aCategory}${pair.qCategory}` as Direction;

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
  pair: QueuePair;
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
  queue: QueuePair[],
  charSet: 'simp' | 'trad',
): AssignQAResult => {
  const pair = queue[0];
  const word = testSet[parseInt(pair.index)];

  const { value: Ax, label: ACs } = resolveCategory(pair.aCategory, word, charSet);
  const { value: Qx, label: QCs } = resolveCategory(pair.qCategory, word, charSet);

  return {
    pair,
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
