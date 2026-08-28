import { Direction } from '../types/models';
import { SessionPlan, directionOf } from '../components/Test/Logic/TestLogic';

/** How long one question takes, by the direction it asks. */
export const DIRECTION_SECONDS: Record<Direction, number> = {
  MP: 8,
  PM: 8,
  MC: 10,
  PC: 10,
  CM: 15,
};

const NEW_WORD_SECONDS = 5;
const SENTENCE_SECONDS_PER_WORD = 30;

/** The share of a session's words that a session with no word list assumes are new. */
const ASSUMED_NEW_WORD_SHARE = 0.2;

export interface StageSettings {
  newWordsEnabled: boolean;
  sentenceReadEnabled: boolean;
  sentenceWriteEnabled: boolean;
  sentenceStagesForAllWords: boolean;
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
 * count are the same number. The sentence stages run for a word that the
 * learner answered cleanly, and only for a new word unless the learner turned
 * them on for all words.
 */
export function estimateTestTime(params: TestTimeEstimateParams): number {
  const {
    directions,
    newWordCount,
    newWordsEnabled,
    sentenceReadEnabled,
    sentenceWriteEnabled,
    sentenceStagesForAllWords,
  } = params;

  let totalSeconds = directions.reduce(
    (sum, direction) => sum + (DIRECTION_SECONDS[direction] ?? 0),
    0,
  );

  if (newWordsEnabled) {
    totalSeconds += newWordCount * NEW_WORD_SECONDS;
  }

  const sentenceWordCount = sentenceStagesForAllWords ? directions.length : newWordCount;

  if (sentenceReadEnabled) {
    totalSeconds += sentenceWordCount * SENTENCE_SECONDS_PER_WORD;
  }
  if (sentenceWriteEnabled) {
    totalSeconds += sentenceWordCount * SENTENCE_SECONDS_PER_WORD;
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
 * place of that count, and it gates both the Learn step and the sentence
 * stages, which are the two parts that only new words reach.
 */
export function assumedNewWordCount(budget: number): number {
  return Math.max(1, Math.round(budget * ASSUMED_NEW_WORD_SHARE));
}

export function formatTestTime(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return '< 1 min';
  }
  const minutes = Math.ceil(totalSeconds / 60);
  return `~${minutes} min`;
}
