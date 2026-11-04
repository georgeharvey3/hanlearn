import { Direction } from '../types/models';
import {
  NEW_WORDS_PER_SESSION,
  SessionPlan,
  directionOf,
} from '../components/Test/Logic/TestLogic';

/** How long one question takes, by the direction it asks. */
export const DIRECTION_SECONDS: Record<Direction, number> = {
  MP: 8,
  PM: 8,
  MC: 10,
  PC: 10,
  CM: 15,
};

const NEW_WORD_SECONDS = 5;

/** The share of a session's words that a session with no word list assumes are new. */
const ASSUMED_NEW_WORD_SHARE = 0.2;

export interface StageSettings {
  newWordsEnabled: boolean;
}

export interface TestTimeEstimateParams extends StageSettings {
  /** One entry for each question the session asks, in any order. */
  directions: Direction[];
  /** How many of those words the Learn step teaches first. */
  newWordCount: number;
}

/**
 * How long a session takes, in seconds.
 *
 * The queue asks one direction of one word, so the question count and the word
 * count are the same number. The sentence tasks are tabs of their own, so they
 * add no time to a session (#489).
 */
export function estimateTestTime(params: TestTimeEstimateParams): number {
  const { directions, newWordCount, newWordsEnabled } = params;

  let totalSeconds = directions.reduce(
    (sum, direction) => sum + (DIRECTION_SECONDS[direction] ?? 0),
    0,
  );

  if (newWordsEnabled) {
    totalSeconds += newWordCount * NEW_WORD_SECONDS;
  }

  return totalSeconds;
}

/**
 * How long a planned session takes, in seconds.
 *
 * The plan holds the questions the session will ask and the words it will
 * teach, so this estimate needs no assumption about either.
 */
export function estimatePlannedTime(plan: SessionPlan, stages: StageSettings): number {
  return estimateTestTime({
    ...stages,
    directions: plan.queue.map(directionOf),
    newWordCount: plan.newWords.length,
  });
}

/**
 * A session of `budget` questions, spread evenly over the directions it may ask.
 *
 * The Settings page has no word list, so it cannot plan a session. It estimates
 * an average one instead: the queue takes the direction that has waited
 * longest, and over many sessions that reaches every eligible direction about
 * equally often.
 */
export function spreadOverDirections(budget: number, directions: Direction[]): Direction[] {
  if (directions.length === 0) return [];
  return Array.from({ length: budget }, (_, index) => directions[index % directions.length]);
}

/**
 * How many words of a session with no word list to treat as new.
 *
 * A real plan counts them. This is the guess the Settings estimate uses in
 * place of that count, for the Learn step, which only new words reach.
 *
 * A plan admits at most NEW_WORDS_PER_SESSION new words, so the guess stops
 * there too: a long session takes more questions, not more new words.
 */
export function assumedNewWordCount(budget: number): number {
  return Math.min(NEW_WORDS_PER_SESSION, Math.max(1, Math.round(budget * ASSUMED_NEW_WORD_SHARE)));
}

export function formatTestTime(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return '< 1 min';
  }
  const minutes = Math.ceil(totalSeconds / 60);
  return `~${minutes} min`;
}
