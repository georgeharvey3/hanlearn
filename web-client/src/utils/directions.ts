import { DIRECTIONS, Direction, DirectionState, DirectionStates, Word } from '../types/models';
import { BANKS, isLeech } from './scheduling';

/**
 * Helpers for the per-direction scheduling state of a word.
 *
 * Every word carries five directions. Documents written before the directions
 * map existed carry only the top-level `bank` and `dueDate`, so the read path
 * synthesizes the map from those two values. As a result no caller has to
 * handle a word without directions, and the Firestore migration is a cleanup
 * rather than a prerequisite.
 *
 * See docs/adr/0002-direction-level-scheduling.md.
 */

/**
 * Build a full directions map with every direction at the same level and due date.
 * This is the shape a new word starts with, and the shape a legacy document
 * takes when its single `bank` is copied across all five directions.
 */
export function makeDirections(level: number, dueDate: string): DirectionStates {
  return DIRECTIONS.reduce((acc, direction) => {
    acc[direction] = { level, dueDate };
    return acc;
  }, {} as DirectionStates);
}

/**
 * Complete a partial or absent directions map, filling any missing direction
 * from the word's top-level level and due date.
 *
 * A stored entry wins over the fallback, so a document that gained the map is
 * never overwritten by the derived values. A partial map can only come from a
 * write that was interrupted, or from a future release that adds a direction.
 */
export function fillDirections(
  stored: Partial<Record<Direction, Partial<DirectionState>>> | undefined,
  level: number,
  dueDate: string,
): DirectionStates {
  return DIRECTIONS.reduce((acc, direction) => {
    const entry = stored?.[direction];
    acc[direction] = {
      level: typeof entry?.level === 'number' ? entry.level : level,
      dueDate: typeof entry?.dueDate === 'string' && entry.dueDate ? entry.dueDate : dueDate,
      // A direction that has never lost a retrieval carries no count, and the
      // fallback has none to give, so both read as none.
      ...(typeof entry?.lapses === 'number' ? { lapses: entry.lapses } : {}),
      // The same for the interval: a direction no session has asked since FSRS
      // arrived carries none, and the bank is all there is to read it from.
      ...(typeof entry?.interval === 'number' ? { interval: entry.interval } : {}),
    };
    return acc;
  }, {} as DirectionStates);
}

/**
 * A word is new when it has never been answered correctly in any direction,
 * that is, when all five directions are still at level 1.
 *
 * The fallback reads the top-level level, for a word built without scheduling
 * state at all — a dictionary search result, for instance.
 */
export function isNewWord(word: Pick<Word, 'level' | 'directions'>): boolean {
  const directions = word.directions;
  if (!directions) return word.level === 1;
  return DIRECTIONS.every((direction) => directions[direction].level === 1);
}

/**
 * The directions the gates of the sentence tabs read: receptive recognition
 * (`MC`, `MP`) and productive recall (`PC`, `PM`).
 *
 * `CM` is left out because handwriting is itself production. A word whose
 * handwriting direction is still at bank 1 can perfectly well be read in a
 * sentence, or used in a sentence written in pinyin.
 */
export const RECALL_DIRECTIONS: readonly Direction[] = ['MC', 'MP', 'PC', 'PM'];

/**
 * The bank every recall direction reaches before the Comprehend tab uses a word.
 *
 * Bank 2 is an interval of 1 to 6 days: the learner has recalled the word in
 * each direction at least once after the day they met it, so the word form is
 * stable enough to meet in context. The tab has no session, so "new word" has
 * no meaning there and the gate is a bank of its own. A starting point to tune
 * with the `sentenceLog` data. See docs/adr/0021-sentence-tasks-are-a-separate-practice.md.
 */
export const COMPREHEND_BANK = 2;

/**
 * The bank every recall direction reaches before the Compose tab uses a word.
 *
 * Bank 3 is an interval of 7 to 29 days, so a word that meets it has survived a
 * week or more in each of the four directions that ask for recall. The research
 * does not name a threshold, so this one is a starting point to tune. It sits
 * above the Comprehend bank, so every Compose word is a Comprehend word too.
 */
export const COMPOSE_BANK = 3;

const reachesBank = (word: Pick<Word, 'level' | 'directions'>, bank: number): boolean => {
  const directions = word.directions;
  if (!directions) return (word.level ?? 1) >= bank;
  return RECALL_DIRECTIONS.every((direction) => directions[direction].level >= bank);
};

/**
 * Whether the learner knows a word well enough for the Comprehend tab. Every
 * recall direction has to clear the bar: one strong direction is not knowledge
 * of the word. The fallback reads the top-level level, for a word built
 * without scheduling state at all.
 */
export function readyForComprehend(word: Pick<Word, 'level' | 'directions'>): boolean {
  return reachesBank(word, COMPREHEND_BANK);
}

/**
 * Whether the learner knows a word well enough for the Compose tab to ask
 * them to produce a sentence with it.
 *
 * Writing a sentence with a word the learner has only just met impedes the
 * encoding of the word form, so Compose waits for partial mastery rather than
 * firing on novelty. See docs/adr/0011-gate-the-write-stage-on-partial-mastery.md.
 */
export function readyForCompose(word: Pick<Word, 'level' | 'directions'>): boolean {
  return reachesBank(word, COMPOSE_BANK);
}

/**
 * The directions of a word that are leeches: the ones the learner has failed to
 * recall enough times that the schedule is not fixing them on its own.
 *
 * The order is the order of `DIRECTIONS`. A word built without scheduling state
 * has none. See docs/adr/0010-partial-demotion-and-leeches.md.
 */
export function leechDirections(word: Pick<Word, 'directions'>): Direction[] {
  const directions = word.directions;
  if (!directions) return [];
  return DIRECTIONS.filter((direction) => isLeech(directions[direction]?.lapses));
}

/**
 * How each direction reads to a learner, as question → answer.
 * The direction itself is written answer-first, so these are reversed.
 */
export const DIRECTION_LABELS: Record<Direction, string> = {
  MC: 'Character → Meaning',
  MP: 'Pinyin → Meaning',
  PM: 'Meaning → Pinyin',
  PC: 'Character → Pinyin',
  CM: 'Meaning → Character',
};

/** How many words sit at each bank, keyed by bank. */
export type BankCounts = Record<number, number>;

/**
 * How many words sit at each bank, counted separately for each direction.
 *
 * The word's own level is the lowest bank across its five directions, so it
 * hides the shape of what the learner knows: a word at level 1 can be strong
 * for recognition and weak for handwriting, and the single level shows only the
 * 1. Counting each direction on its own is what makes the weak skill visible.
 *
 * Every direction counts every word, so each direction's counts sum to the
 * number of words. A word built without scheduling state falls back to its
 * top-level level in all five, which is the fallback `fillDirections` makes.
 */
export function directionBankDistribution(
  words: Pick<Word, 'level' | 'directions'>[],
): Record<Direction, BankCounts> {
  const distribution = DIRECTIONS.reduce(
    (acc, direction) => {
      acc[direction] = BANKS.reduce((counts, bank) => {
        counts[bank] = 0;
        return counts;
      }, {} as BankCounts);
      return acc;
    },
    {} as Record<Direction, BankCounts>,
  );

  for (const word of words) {
    for (const direction of DIRECTIONS) {
      const level = word.directions?.[direction]?.level ?? word.level ?? 1;
      // Clamp rather than drop, so the counts of a direction always sum to the
      // number of words and the bars read as a whole.
      const bank = Math.min(5, Math.max(1, Math.round(level)));
      distribution[direction][bank] += 1;
    }
  }

  return distribution;
}
