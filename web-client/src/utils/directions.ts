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
 * The directions the Write stage gate reads: receptive recognition (`MC`, `MP`)
 * and productive recall (`PC`, `PM`).
 *
 * `CM` is left out because handwriting is itself production, and production is
 * the thing the gate holds back. A word whose handwriting direction is still at
 * bank 1 can perfectly well write a sentence with the word in pinyin.
 */
export const RECALL_DIRECTIONS: readonly Direction[] = ['MC', 'MP', 'PC', 'PM'];

/**
 * The bank every recall direction reaches before the Write stage runs.
 *
 * Bank 3 is an interval of 7 to 29 days, so a word that meets it has survived a
 * week or more in each of the four directions that ask for recall. The research
 * does not name a threshold, so this one is a starting point to tune.
 */
export const WRITE_STAGE_BANK = 3;

/**
 * Whether the learner knows a word well enough for the Write stage to ask them
 * to produce a sentence with it.
 *
 * Writing a sentence with a word the learner has only just met impedes the
 * encoding of the word form, so the Write stage waits for partial mastery
 * rather than firing on novelty. Every recall direction has to clear the bar:
 * one strong direction is not knowledge of the word.
 *
 * The fallback reads the top-level level, for a word built without scheduling
 * state at all. See docs/adr/0011-gate-the-write-stage-on-partial-mastery.md.
 */
export function readyForWriteStage(word: Pick<Word, 'level' | 'directions'>): boolean {
  const directions = word.directions;
  if (!directions) return (word.level ?? 1) >= WRITE_STAGE_BANK;
  return RECALL_DIRECTIONS.every((direction) => directions[direction].level >= WRITE_STAGE_BANK);
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
